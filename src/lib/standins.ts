import crypto from "crypto";
import sharp from "sharp";
import type postgres from "postgres";
import { sql } from "./db";
import * as store from "./storage";
import { env } from "./env";
import { editImage, dataUrl } from "./llm";
import { facesIn, similarity, MATCH_THRESHOLD, type Region } from "./faces";
import { tileRect, tileGrid, type TileRect } from "./tiles";

/*
 * AI stand-ins: on paid events the host can have covered heads replaced by a fictional face.
 * Privacy rests on four rules, all enforced here and in render():
 *  1. The image model only ever receives the already-tiled public render (never the original).
 *  2. Only pixels renderTiled actually tiled may change; everything else is the tiled render, checked.
 *  3. Any failure, cap or doubt publishes the plain tiled render. Generation never delays publishing.
 *  4. A stand-in that looks like the person it covers, or like any guest, is discarded.
 */

export const MAX_EVENT_RUNS = 300; // paid generations per event (~$21)
export const MAX_HOST_RUNS = 600; // per host across all events: events are free, so the event cap alone has no ceiling
// Whole service, last 24 hours (~$35 at the default). A bad value falls back to the default rather than disabling the cap.
export const DAILY_RUNS = Number.isFinite(Number(process.env.STANDIN_DAILY)) && Number(process.env.STANDIN_DAILY) > 0 ? Number(process.env.STANDIN_DAILY) : 500;
export const MAX_ATTEMPTS = 2; // per photo and tiled set: the model is not deterministic, but one bad photo must not drain the caps
// The model never sees the covered face, so similarity here is coincidence; strangers score up to ~0.69 on this
// model. Reject anything at or above 0.6, comfortably below the 0.8 bar for "same person".
export const SAME_PERSON = 0.6;
const FEATHER = 4; // px, blended inwards from the tiled area's edge, so nothing outside it changes
// Written into every published stand-in JPEG (its only metadata). No parentheses: libvips reads "(...)" in an EXIF string as type info.
export const DISCLOSURE = "Faces of people who did not opt in are AI-generated stand-ins - Lumzel";
/** Re-encoded copies of a stand-in photo (thumbnails, link previews) keep the AI disclosure. */
export const disclose = (img: import("sharp").Sharp, ai: boolean) => (ai ? img.withExif({ IFD0: { ImageDescription: DISCLOSURE, Software: "Lumzel" } }).withXmp(XMP) : img);
export const XMP = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`
  + `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"`
  + ` Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia">`
  + `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${DISCLOSURE}</rdf:li></rdf:Alt></dc:description>`
  + `</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
const ASPECT_TOLERANCE = 0.02;
const TIMEOUT_MS = 90_000;
const MAX_DRIFT = { frame: 20, ring: 40 }; // mean abs difference outside the rectangles; see drift()
// mozjpeg's tables and scans, minus trellis quantisation: trellis optimises across neighbouring blocks, so a change
// inside a rectangle could shift pixels far outside it. Without it, the encode stays local to the blocks it touches.
export const JPEG_OPTS = { quality: 86, quantisationTable: 3, overshootDeringing: true, optimiseScans: true, optimiseCoding: true, progressive: true } as const;

export const PROMPT = "This photo has people whose faces are hidden by mosaics of square tiles. Replace ONLY each tiled mosaic with a natural, photorealistic head and face of a completely fictional adult who does not exist, matching that person's pose, head angle, lighting, the skin tone suggested by the tiles, hair, and the photo's style. Keep every other pixel exactly the same: do not change any other person's face, body, clothing, the background, framing or colours. Same image size and composition.";

export type FaceStyle = "tiles" | "standins";
/** Stand-ins are part of social sharing: a locked event always gets tiles, whatever the column says. */
export const useStandins = (ev: { face_style?: string | null; sharing_unlocked?: boolean | null }) => ev.face_style === "standins" && !!ev.sharing_unlocked;

type Rect = { x: number; y: number; w: number; h: number; t: TileRect };

/** Identifies a set of tiled regions (order-independent). A changed set never reuses an old stand-in. */
export function setHash(toTile: Region[]): string {
  const parts = toTile.map((r) => [r.kind, r.x, r.y, r.w, r.h].map((v) => (typeof v === "number" ? v.toFixed(1) : v)).join(":")).sort();
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** The rectangles renderTiled drew tiles in (tiles.ts tileRect); the mask narrows each to the blocks actually drawn. */
export function rectsFor(toTile: Region[], width: number, height: number): Rect[] {
  return toTile.flatMap((r) => { const t = tileRect(r, width, height); return t ? [{ x: t.ex, y: t.ey, w: t.ew, h: t.eh, t }] : []; });
}

/**
 * One rectangle's mask, w*h, 0..1: 1 on the blocks renderTiled drew (tiles.ts tileGrid, the ellipse), feathered to 0
 * over FEATHER px inwards from their outline (not along image borders), 0 everywhere else, rectangle corners included.
 */
export function rectMask(r: Rect, width: number, height: number): Float32Array {
  const { w, h } = r, { block } = r.t, { gc, gr, drawn } = tileGrid(r.t);
  const W = w + 2, H = h + 2, BIG = 1e6;
  const d = new Float32Array(W * H); // Chebyshev distance to the nearest untiled pixel; a 1px border around the rectangle
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const offImage = r.x + x < 0 || r.y + y < 0 || r.x + x >= width || r.y + y >= height;
    const i = Math.floor(x / block), j = Math.floor(y / block);
    const tiled = x >= 0 && y >= 0 && x < w && y < h && i < gc && j < gr && drawn(i, j);
    d[(y + 1) * W + x + 1] = tiled || offImage ? BIG : 0;
  }
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) { // two-pass chamfer, 8-connected unit steps
    const k = y * W + x;
    d[k] = Math.min(d[k], d[k - W] + 1, x > 0 ? d[k - W - 1] + 1 : BIG, x < W - 1 ? d[k - W + 1] + 1 : BIG, x > 0 ? d[k - 1] + 1 : BIG);
  }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const k = y * W + x;
    d[k] = Math.min(d[k], d[k + W] + 1, x > 0 ? d[k + W - 1] + 1 : BIG, x < W - 1 ? d[k + W + 1] + 1 : BIG, x < W - 1 ? d[k + 1] + 1 : BIG);
  }
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tiled = Math.floor(x / block) < gc && Math.floor(y / block) < gr && drawn(Math.floor(x / block), Math.floor(y / block));
    if (tiled) m[y * w + x] = Math.min(1, d[(y + 1) * W + x + 1] / (FEATHER + 1));
  }
  return m;
}

/** The whole image's mask: the maximum of every rectangle's mask. */
export function maskFor(rects: Rect[], width: number, height: number): Float32Array {
  const m = new Float32Array(width * height);
  for (const r of rects) {
    const rm = rectMask(r, width, height);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const a = rm[y * r.w + x], i = (r.y + y) * width + r.x + x;
      if (a > m[i]) m[i] = a;
    }
  }
  return m;
}

const inAnyRect = (rects: Array<{ x: number; y: number; w: number; h: number }>, x: number, y: number) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

async function rawRgb(img: Buffer) {
  const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error("expected RGB");
  return { data, width: info.width, height: info.height };
}

/**
 * The model's image as an overlay for the tiled render: resized to the render's exact size, transparent
 * (and blank) outside the rectangles. Throws if the aspect ratio moved, since a reframed image can't line up.
 */
export async function overlayFrom(model: Buffer, rects: Rect[], width: number, height: number): Promise<Buffer> {
  const meta = await sharp(model, { limitInputPixels: 4096 * 4096 }).metadata();
  if (!meta.width || !meta.height) throw new Error("model image unreadable");
  const drift = Math.abs(meta.width / meta.height / (width / height) - 1);
  if (drift > ASPECT_TOLERANCE) throw new Error(`aspect: model ${meta.width}x${meta.height}, render ${width}x${height}`);
  const { data } = await sharp(model, { limitInputPixels: 4096 * 4096 }).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = maskFor(rects, width, height);
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const a = Math.round(mask[i] * 255);
    if (!a) continue;
    rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = a;
  }
  return rgba;
}

export const overlayPng = (rgba: Buffer, width: number, height: number) => sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();

/**
 * Blends an overlay onto the tiled render. The alpha used is capped by the mask of the CURRENT rectangles, so a
 * stale or wrong overlay still can't touch anything the tiles didn't cover, and then every pixel outside the mask is
 * compared with the tiled render: any difference throws (and the caller publishes tiles). `changes` is the mean
 * change per rectangle, over its fully replaced pixels.
 */
export async function composite(tiled: Buffer, overlayRgba: Buffer, rects: Rect[]) {
  const t = await rawRgb(tiled);
  const { width, height } = t;
  if (overlayRgba.length !== width * height * 4) throw new Error("overlay size mismatch");
  const mask = maskFor(rects, width, height);
  const out = Buffer.from(t.data);
  for (let i = 0; i < width * height; i++) {
    const a = Math.min(overlayRgba[i * 4 + 3] / 255, mask[i]);
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(t.data[i * 3 + c] * (1 - a) + overlayRgba[i * 4 + c] * a);
  }
  const outsideDiffs = countOutsideDiffs(t.data, out, rects, width, height);
  if (outsideDiffs) throw new Error(`compositor changed ${outsideDiffs} pixels outside the tiled regions`);
  const changes = rects.map((r) => {
    const rm = rectMask(r, width, height);
    let changed = 0, inside = 0;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (rm[y * r.w + x] < 1) continue;
      const i = ((r.y + y) * width + r.x + x) * 3;
      for (let c = 0; c < 3; c++) changed += Math.abs(out[i + c] - t.data[i + c]);
      inside++;
    }
    return inside ? changed / (inside * 3) : 0;
  });
  return { raw: out, jpeg: await encode(out, width, height), width, height, changes };
}

/** The published stand-in JPEG: fresh from raw pixels (nothing of the original's metadata), plus the AI disclosure. */
export const encode = (raw: Buffer, width: number, height: number) =>
  sharp(raw, { raw: { width, height, channels: 3 } })
    .withExif({ IFD0: { ImageDescription: DISCLOSURE, Software: "Lumzel" } }).withXmp(XMP)
    .jpeg(JPEG_OPTS).toBuffer();

/** Pixels outside the tiled area (mask 0) that differ between two raw RGB images of the same size. */
export function countOutsideDiffs(a: Buffer, b: Buffer, rects: Rect[], width: number, height: number) {
  const mask = maskFor(rects, width, height);
  let n = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 3;
    if ((a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) && mask[p] <= 0) n++;
  }
  return n;
}

/**
 * How far the model moved things it should have kept (mean abs difference, 0..255), on a 512px copy: over the whole
 * frame outside the rectangles, and in a ring just outside each rectangle, where a face that came back shifted or
 * resized would show. Neither can leak anything (only rectangle pixels are used); a misaligned head just looks wrong.
 */
export async function drift(tiled: Buffer, model: Buffer, rects: Rect[], width: number, height: number) {
  const W = 512, H = Math.max(1, Math.round((W * height) / width)), sx = W / width, sy = H / height;
  const [a, b] = await Promise.all([tiled, model].map((x) => sharp(x, { limitInputPixels: 4096 * 4096 }).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer()));
  const small = rects.map((r) => ({ x: Math.floor(r.x * sx) - 1, y: Math.floor(r.y * sy) - 1, w: Math.ceil(r.w * sx) + 2, h: Math.ceil(r.h * sy) + 2 }));
  const diff = (x: number, y: number) => { const i = (y * W + x) * 3; return (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3; };
  let sum = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inAnyRect(small, x, y)) { sum += diff(x, y); n++; }
  let ring = 0;
  for (const r of small) {
    const m = Math.max(3, Math.round(Math.min(r.w, r.h) * 0.3));
    let rs = 0, rn = 0;
    for (let y = Math.max(0, r.y - m); y < Math.min(H, r.y + r.h + m); y++) for (let x = Math.max(0, r.x - m); x < Math.min(W, r.x + r.w + m); x++)
      if (!inAnyRect(small, x, y)) { rs += diff(x, y); rn++; }
    if (rn) ring = Math.max(ring, rs / rn);
  }
  return { frame: n ? sum / n : 0, ring };
}

type Guest = { embedding: number[] | null };
type NewFace = { embedding: number[]; covers: number[][] }; // a face found in the composite, and the originals it sits over

/**
 * Throws if a new face resembles a face it covers (>= SAME_PERSON) or matches any guest (>= MATCH_THRESHOLD).
 * `covers` is empty for a cached stand-in: the originals don't change, so only the guest check is re-run.
 */
async function assertStrangers(faces: NewFace[], guests: Guest[]) {
  const known = guests.map((g) => g.embedding).filter((e): e is number[] => !!e?.length);
  for (const f of faces) {
    if (!f.embedding?.length) throw new Error("identity: a stand-in face has no embedding to check");
    for (const o of f.covers) { const s = await similarity(f.embedding, o); if (s >= SAME_PERSON) throw new Error(`identity: stand-in resembles the face it covers (${s.toFixed(2)})`); }
    for (const gst of known) { const s = await similarity(f.embedding, gst); if (s >= MATCH_THRESHOLD) throw new Error(`identity: stand-in matches a guest (${s.toFixed(2)})`); }
  }
}

/**
 * The faces now inside the replaced rectangles (detected on a padded crop of each, kept if centred inside), each with
 * the original embeddings of every covered region whose rectangle it sits in (its own, plus any overlapping one).
 * Fails closed, per rectangle: one that covered a face with an embedding must now hold exactly one face, with an
 * embedding (else the likeness check can't run); in any other, every face found must have an embedding.
 */
export async function newFaces(raw: Buffer, width: number, height: number, toTile: Region[], detect = facesIn): Promise<NewFace[]> {
  const found: NewFace[] = [];
  const img = sharp(raw, { raw: { width, height, channels: 3 } });
  const pairs = toTile.flatMap((reg) => { const t = tileRect(reg, width, height); return t ? [{ reg, r: { x: t.ex, y: t.ey, w: t.ew, h: t.eh } }] : []; });
  const inside = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (const { reg, r } of pairs) {
    const px = Math.round(r.w * 0.3), py = Math.round(r.h * 0.3);
    const left = Math.max(0, r.x - px), top = Math.max(0, r.y - py);
    const cw = Math.min(width, r.x + r.w + px) - left, ch = Math.min(height, r.y + r.h + py) - top;
    const crop = await img.clone().extract({ left, top, width: cw, height: ch }).jpeg({ quality: 92 }).toBuffer();
    const here = (await detect(crop)).map((f) => ({ ...f, cx: left + f.x + f.w / 2, cy: top + f.y + f.h / 2 })).filter((f) => inside(r, f.cx, f.cy));
    if (here.some((f) => !f.embedding?.length)) throw new Error("identity: a face in a replaced region has no embedding");
    if (reg.embedding?.length && here.length !== 1) throw new Error(`identity: ${here.length} faces where one covered face was replaced`);
    for (const f of here) found.push({ embedding: f.embedding!, covers: pairs.filter((p) => inside(p.r, f.cx, f.cy) && p.reg.embedding?.length).map((p) => p.reg.embedding!) });
  }
  return found;
}

/**
 * The stand-in version of a tiled render, if one was made for exactly this set of tiled regions and its faces
 * still match no guest (guests may have joined since). Null means: publish the tiles.
 */
export async function cachedStandin(photoId: string, hash: string, tiled: Buffer, toTile: Region[], guests: Guest[]): Promise<Buffer | null> {
  try {
    const [c] = await sql<{ key: string; faces: number[][] }[]>`select key, faces from standin_cache where photo_id = ${photoId} and set_hash = ${hash}`;
    if (!c) return null;
    await assertStrangers(c.faces.map((embedding) => ({ embedding, covers: [] })), guests); // guests may have joined since
    const png = await store.get(c.key);
    if (!png) return null;
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const t = await sharp(tiled).metadata();
    if (info.width !== t.width || info.height !== t.height || info.channels !== 4) return null;
    return (await composite(tiled, data, rectsFor(toTile, info.width, info.height))).jpeg;
  } catch (e) {
    console.warn("[standins] cached version not used", photoId, (e as Error).message);
    return null;
  }
}

/**
 * Claims one paid generation against every cap, in one locked transaction, before any money is spent.
 * A claimed run is never refunded: a failed model call may still have been billed.
 */
async function claim(photoId: string, eventId: string, hash: string, publicKey: string): Promise<number | null> {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('standin-runs'))`; // serialise the cap checks
    // The photo must still be exactly the published tiled render we read; locked so it can't change mid-claim.
    if (!(await current(photoId, hash, publicKey, tx, true)).length) return null;
    const [ev] = await tx`select host_id, standin_runs, face_style, sharing_unlocked from events where id = ${eventId} for share`;
    if (!ev || !useStandins(ev)) return null;
    const [{ host, day, tries }] = await tx`select
        (select coalesce(sum(standin_runs), 0)::int from events where host_id = ${ev.host_id}) as host,
        (select count(*)::int from standin_run where created_at > now() - interval '1 day') as day,
        (select count(*)::int from standin_run where photo_id = ${photoId} and set_hash = ${hash}) as tries`;
    if (ev.standin_runs >= MAX_EVENT_RUNS || host >= MAX_HOST_RUNS || day >= DAILY_RUNS || tries >= MAX_ATTEMPTS) return null;
    await tx`update events set standin_runs = standin_runs + 1 where id = ${eventId}`;
    const [run] = await tx`insert into standin_run (event_id, photo_id, set_hash, model) values (${eventId}, ${photoId}, ${hash}, ${env.standinModel}) returning id`;
    return run.id as number;
  });
}

/**
 * One paid generation, end to end. Sends the model ONLY `tiled` (the public render for `toTile`), composites its
 * answer back inside the tiled rectangles only, checks identities, and caches the result. Returns why it stopped.
 */
export async function generate(photoId: string, eventId: string, hash: string, tiled: Buffer, toTile: Region[], publicKey: string): Promise<string> {
  const [have] = await sql`select 1 from standin_cache where photo_id = ${photoId} and set_hash = ${hash}`;
  if (have) return "cached";
  const { width, height } = await sharp(tiled).metadata() as { width: number; height: number };
  const rects = rectsFor(toTile, width, height);
  if (!rects.length) return "nothing tiled";
  const runId = await claim(photoId, eventId, hash, publicKey);
  if (runId == null) return "capped";
  let outcome = "error", error: string | null = null;
  try {
    if (!(await current(photoId, hash, publicKey)).length) { // changed since the claim: nothing sent, so refund it
      await sql.begin(async (tx) => {
        await tx`delete from standin_run where id = ${runId}`;
        await tx`update events set standin_runs = greatest(0, standin_runs - 1) where id = ${eventId}`;
      });
      outcome = "changed"; return outcome;
    }
    const img = await editImage(env.standinModel, PROMPT, dataUrl(tiled), TIMEOUT_MS);
    if (!img) { outcome = "no_image"; return outcome; }
    const overlay = await overlayFrom(img, rects, width, height);
    const off = await drift(tiled, img, rects, width, height);
    if (off.frame > MAX_DRIFT.frame || off.ring > MAX_DRIFT.ring) throw new Error(`drift: model moved the photo (frame ${off.frame.toFixed(1)}, ring ${off.ring.toFixed(1)})`);
    const out = await composite(tiled, overlay, rects);
    if (out.changes.some((c) => c < 4)) throw new Error(`model left tiles in place (${out.changes.map((c) => c.toFixed(1)).join(", ")})`);
    const faces = await newFaces(out.raw, width, height, toTile);
    const guests = await sql<Guest[]>`select embedding from guests where event_id = ${eventId} and embedding is not null`;
    await assertStrangers(faces, guests);
    const key = `e/${eventId}/standin/${photoId}-${hash}.png`;
    await store.put(key, await overlayPng(overlay, width, height), "image/png");
    await sql`insert into standin_cache (photo_id, set_hash, key, faces) values (${photoId}, ${hash}, ${key}, ${sql.json(faces.map((f) => f.embedding) as never)})
      on conflict (photo_id, set_hash) do update set key = excluded.key, faces = excluded.faces`;
    outcome = "ok";
    console.log(`[standins] ${photoId} ok: ${faces.length} new face(s), drift frame ${off.frame.toFixed(1)} ring ${off.ring.toFixed(1)}`);
    return outcome;
  } catch (e) {
    error = String((e as Error).message).slice(0, 300);
    outcome = (error.match(/^(identity|aspect|drift)/) ?? [])[1] ?? "error";
    console.warn("[standins]", photoId, error);
    return outcome;
  } finally {
    await sql`update standin_run set outcome = ${outcome}, error = ${error}, finished_at = now() where id = ${runId}`.catch(() => {});
  }
}

// A small queue of its own: generation never holds up the render queue, and at most two run at once.
type Job = () => Promise<void>;
const g = globalThis as unknown as { __lzS?: { q: Job[]; running: number; pending: Set<string> } };
const S = g.__lzS ?? (g.__lzS = { q: [], running: 0, pending: new Set() });
function pump() {
  while (S.running < 2 && S.q.length) {
    const job = S.q.shift()!;
    S.running++;
    job().catch((e) => console.error("[standins]", e)).finally(() => { S.running--; pump(); });
  }
}

/** The photo still shows plain tiles for exactly this set (and, if given, this version): published, not marked, not held. */
const current = (photoId: string, hash: string, publicKey?: string, q: typeof sql | postgres.TransactionSql = sql, lock = false) =>
  q<{ public_key: string }[]>`select public_key from photos where id = ${photoId} and tile_set = ${hash} and not has_standins
    and stale_at is null and not hold and status = 'ready' and public_key is not null
    and (${publicKey ?? null}::text is null or public_key = ${publicKey ?? null}) ${lock ? q`for update` : q``}`;

/**
 * After the tiled version is published: make the stand-in version in the background, then ask for a re-render,
 * which publishes it from the cache. The image sent is the published tiled render itself (render() stored exactly
 * renderTiled's output for this set), read back only while the photo is unchanged; nothing is spent otherwise.
 * When done, the re-render is asked for only if the photo is still unchanged; if it was marked stale or held
 * meanwhile, that render decides, and uses this result only if it ends up with the same tiled set.
 */
export function requestStandins(job: { photoId: string; eventId: string; hash: string; toTile: Region[]; key: string }, rerender: (id: string) => void) {
  if (!env.openrouterKey) return;
  const k = `${job.photoId}:${job.hash}`;
  if (S.pending.has(k)) return;
  S.pending.add(k);
  S.q.push(async () => {
    try {
      const [p] = await current(job.photoId, job.hash, job.key);
      const tiled = p && (await store.get(p.public_key));
      if (!tiled) return;
      const outcome = await generate(job.photoId, job.eventId, job.hash, tiled, job.toTile, p.public_key);
      if (outcome === "ok" && (await current(job.photoId, job.hash)).length) rerender(job.photoId);
    } finally { S.pending.delete(k); }
  });
  pump();
}

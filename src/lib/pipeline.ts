import sharp from "sharp";
import { sql } from "./db";
import * as store from "./storage";
import { detectRegions, similarity, MATCH_THRESHOLD, type Region } from "./faces";
import { renderTiled } from "./tiles";
import { chat, parseJson, dataUrl } from "./llm";
import { env } from "./env";

// A small in-process queue. One Railway instance; photos in 'processing' are re-queued at boot.
type Job = () => Promise<void>;
const g = globalThis as unknown as { __lzQ?: { q: Job[]; running: number } };
const Q = g.__lzQ ?? (g.__lzQ = { q: [], running: 0 });
const CONCURRENCY = 2;

function pump() {
  while (Q.running < CONCURRENCY && Q.q.length) {
    const job = Q.q.shift()!;
    Q.running++;
    job().catch((e) => console.error("[pipeline]", e)).finally(() => { Q.running--; pump(); });
  }
}
export function enqueue(job: Job) { Q.q.push(job); pump(); }
export const queueDepth = () => Q.q.length + Q.running;

/** Ingest: normalise orientation, cap size, strip all metadata (GPS included). */
export async function ingest(input: Buffer) {
  const img = sharp(input, { failOn: "none" }).rotate().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true });
  const buf = await img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width ?? 0, height: meta.height ?? 0 };
}

export function processPhoto(photoId: string) {
  enqueue(async () => {
    const [p] = await sql`select * from photos where id = ${photoId}`;
    if (!p) return;
    try {
      const original = await store.get(p.original_key);
      if (!original) throw new Error("original missing");
      const { regions } = await detectRegions(original);
      await sql`update photos set regions = ${sql.json(regions as never)} where id = ${photoId}`;
      // Safety net: ask a vision model whether any face survived when EVERYONE is tiled.
      // It never sees an untiled face.
      let modelCount: number | null = null;
      try { modelCount = await untiledFaces(await renderTiled(original, regions)); } catch (e) { console.warn("[pipeline] vision check skipped", (e as Error).message); }
      const needsReview = modelCount !== null && modelCount > 0;
      await sql`update photos set model_count = ${modelCount}, needs_review = ${needsReview} where id = ${photoId}`;
      await render(photoId);
    } catch (e) {
      console.error("[pipeline] photo failed", photoId, e);
      await sql`update photos set status = 'failed', error = ${String((e as Error).message).slice(0, 300)} where id = ${photoId}`;
    }
  });
}

async function untiledFaces(tiled: Buffer): Promise<number> {
  if (!env.openrouterKey) return 0;
  const small = await sharp(tiled).resize({ width: 1280, height: 1280, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  const out = await chat(env.visionModel, [
    { role: "system", content: "You check photos for privacy. Some faces are hidden by a mosaic of square tiles. Count only human faces that are still recognisable: not covered by tiles, including small, background, side-on or partly hidden faces, faces on screens or posters, and reflections. Reply as JSON: {\"visible_faces\": number, \"where\": string}." },
    { role: "user", content: [{ type: "text", text: "How many recognisable human faces are NOT covered by tiles?" }, { type: "image_url", image_url: { url: dataUrl(small) } }] },
  ], { json: true, temperature: 0, maxTokens: 200, timeoutMs: 30000 });
  const j = parseJson<{ visible_faces: number }>(out);
  return typeof j?.visible_faces === "number" ? j.visible_faces : 0;
}

/** Match faces to guests, tile everyone who isn't a confirmed "Show me", and publish. Idempotent. */
export async function render(photoId: string) {
  const [p] = await sql`select * from photos where id = ${photoId}`;
  if (!p) return;
  const original = await store.get(p.original_key);
  if (!original) return;
  const guests = await sql`select id, choice, embedding from guests where event_id = ${p.event_id} and embedding is not null`;
  const regions = (p.regions as Region[]).map((r) => ({ ...r }));
  const people = new Set<string>();
  for (const r of regions) {
    r.guestId = null;
    if (r.kind !== "face" || !r.embedding) continue;
    let best = 0, who: string | null = null;
    for (const gst of guests) {
      const s = await similarity(r.embedding, gst.embedding as number[]);
      if (s > best) { best = s; who = gst.id as string; }
    }
    if (who && best >= MATCH_THRESHOLD) { r.guestId = who; people.add(who); }
  }
  const showing = new Set(guests.filter((x) => x.choice === "show").map((x) => x.id as string));
  const toTile = regions.filter((r) => !(r.guestId && showing.has(r.guestId)));
  const out = await renderTiled(original, toTile);
  const rev = (p.render_rev as number) + 1;
  const key = `e/${p.event_id}/pub/${photoId}-${rev}.jpg`;
  await store.put(key, out);
  const status = p.needs_review && !p.reviewed_at ? "review" : "ready";
  await sql.begin(async (tx) => {
    await tx`update photos set public_key = ${key}, render_rev = ${rev}, tiled_count = ${toTile.length}, status = ${status},
      regions = ${tx.json(regions.map((r) => ({ ...r })) as never)} where id = ${photoId}`;
    await tx`delete from photo_people where photo_id = ${photoId}`;
    for (const gid of people) await tx`insert into photo_people (photo_id, guest_id) values (${photoId}, ${gid}) on conflict do nothing`;
  });
  if (p.public_key && p.public_key !== key) await store.del(p.public_key);
}

/** Someone changed their choice or selfie: every photo of the event is re-rendered. */
export async function rerenderEvent(eventId: string) {
  const rows = await sql`select id from photos where event_id = ${eventId} and status in ('ready','review')`;
  for (const r of rows) enqueue(() => render(r.id as string));
}

export async function resumePending() {
  const rows = await sql`select id from photos where status = 'processing'`;
  for (const r of rows) processPhoto(r.id as string);
}

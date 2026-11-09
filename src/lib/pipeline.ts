import sharp from "sharp";
import type postgres from "postgres";
import { sql } from "./db";
import * as store from "./storage";
import { detectRegions, similarity, MATCH_THRESHOLD, MATCH_MARGIN, type Region } from "./faces";
import { renderTiled } from "./tiles";
import { useStandins, setHash, cachedStandin, requestStandins } from "./standins";
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
function enqueue(job: Job) { Q.q.push(job); pump(); }
export const queueDepth = () => Q.q.length + Q.running;

// At most one render per photo at a time. A request that arrives mid-render runs once more afterwards,
// so the last state always wins.
const R = (g as unknown as { __lzR?: Map<string, "queued" | "running" | "again"> });
const renders = R.__lzR ?? (R.__lzR = new Map());
export function requestRender(photoId: string) {
  const st = renders.get(photoId);
  if (st === "queued" || st === "again") return;
  if (st === "running") { renders.set(photoId, "again"); return; }
  renders.set(photoId, "queued");
  enqueue(async () => {
    renders.set(photoId, "running");
    let retry = false;
    try { await render(photoId); retries.delete(photoId); }
    catch (e) {
      console.error("[pipeline] render failed", photoId, e);
      const n = (retries.get(photoId) ?? 0) + 1;
      retries.set(photoId, n);
      // A first render that keeps failing is recorded as failed. A re-render keeps its mark (and hold);
      // after five quick retries the scheduler's requeueStale picks it up again.
      if (n >= 5) { retries.delete(photoId); await sql`update photos set status = 'failed', error = ${String((e as Error).message).slice(0, 300)} where id = ${photoId} and status = 'processing'`.catch(() => {}); }
      else retry = true;
    }
    finally {
      const again = renders.get(photoId) === "again";
      renders.delete(photoId);
      if (again) requestRender(photoId);
      else if (retry) setTimeout(() => requestRender(photoId), 15_000 * 2 ** (retries.get(photoId) ?? 1));
    }
  });
}
const retries = new Map<string, number>();

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
      // If the check is configured but fails, the photo waits in review (model_count null) and the
      // scheduler retries the check, rather than the photo going out unchecked.
      let modelCount: number | null = null, needsReview = false;
      try { modelCount = await untiledFaces(await renderTiled(original, regions)); needsReview = modelCount > 0; }
      catch (e) { console.warn("[pipeline] vision check failed", (e as Error).message); needsReview = !!env.openrouterKey; }
      await sql`update photos set model_count = ${modelCount}, needs_review = ${needsReview} where id = ${photoId}`;
      requestRender(photoId);
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
  ], { json: true, temperature: 0, maxTokens: 400, timeoutMs: 30000 });
  const j = parseJson<{ visible_faces: number }>(out);
  if (typeof j?.visible_faces !== "number") throw new Error(`vision check gave no count: ${JSON.stringify(out.slice(0, 160))}`);
  return j.visible_faces;
}

/** Match faces to guests, tile everyone who isn't a confirmed "Show me", and publish. Idempotent. */
async function render(photoId: string) {
  const [p] = await sql`select * from photos where id = ${photoId}`;
  if (!p) return;
  const staleAt = p.stale_at as Date | null;
  const original = await store.get(p.original_key);
  if (!original) { await sql`update photos set status = 'failed', error = 'original missing', stale_at = null where id = ${photoId}`; return; }
  const guests = await sql`select id, choice, embedding from guests where event_id = ${p.event_id} and embedding is not null`;
  const regions = (p.regions as Region[]).map((r) => ({ ...r }));
  // Each guest matches at most one face per photo (their best), so a lookalike or reflection stays tiled.
  const pairs: Array<{ r: Region; who: string; s: number }> = [];
  for (const r of regions) {
    r.guestId = null;
    if (r.kind !== "face" || !r.embedding) continue;
    // Only a clear match counts: above the threshold and well ahead of the next most similar guest.
    const scored = [];
    for (const gst of guests) scored.push({ who: gst.id as string, s: await similarity(r.embedding, gst.embedding as number[]) });
    scored.sort((a, b) => b.s - a.s);
    const [best, second] = scored;
    if (best && best.s >= MATCH_THRESHOLD && (!second || best.s - second.s >= MATCH_MARGIN)) pairs.push({ r, ...best });
  }
  const people = new Set<string>();
  for (const { r, who } of pairs.sort((a, b) => b.s - a.s)) {
    if (r.guestId || people.has(who)) continue;
    r.guestId = who; people.add(who);
  }
  const showing = new Set(guests.filter((x) => x.choice === "show").map((x) => x.id as string));
  const toTile = regions.filter((r) => !(r.guestId && showing.has(r.guestId)));
  const out = await renderTiled(original, toTile);
  // AI stand-ins (paid events): only ever made from `out`, the tiled render, and only once the photo is past review
  // (a reviewer must see tiles, not faces). A stand-in made for exactly this tiled set is reused; otherwise the
  // tiles go out now and the stand-in version follows as a later render. Any doubt publishes the tiles.
  const [ev] = await sql`select face_style, sharing_unlocked from events where id = ${p.event_id}`;
  const hash = setHash(toTile);
  const wantStandins = !!ev && useStandins(ev) && toTile.length > 0 && !(p.needs_review && !p.reviewed_at) && !["hidden", "failed"].includes(p.status);
  const standin = wantStandins ? await cachedStandin(photoId, hash, out, toTile, guests as never) : null;
  const rev = (p.render_rev as number) + 1;
  const key = `e/${p.event_id}/pub/${photoId}-${rev}.jpg`;
  await store.put(key, standin ?? out);
  let status = "", settled = false;
  await sql.begin(async (tx) => {
    // Status from the row as it is now: the host may have hidden or approved it while we rendered.
    const [row] = await tx`update photos set public_key = ${key}, render_rev = ${rev}, tiled_count = ${toTile.length},
      has_standins = ${!!standin}, tile_set = ${hash},
      status = case when status in ('hidden', 'failed') then status when needs_review and reviewed_at is null then 'review' else 'ready' end,
      regions = ${tx.json(regions.map((r) => ({ ...r })) as never)} where id = ${photoId} returning status`;
    status = (row?.status as string) ?? "";
    // Clear the re-render mark only if nobody changed anything while we rendered.
    settled = (await tx`update photos set stale_at = null, hold = false where id = ${photoId} and date_trunc('milliseconds', stale_at) is not distinct from ${staleAt}`).count > 0;
    await tx`delete from photo_people where photo_id = ${photoId}`;
    for (const gid of people) await tx`insert into photo_people (photo_id, guest_id) values (${photoId}, ${gid}) on conflict do nothing`;
  });
  if (p.public_key && p.public_key !== key) await store.del(p.public_key);
  // Not when a newer change already marked it again: that render decides (and pays) instead.
  if (wantStandins && !standin && status === "ready" && settled) requestStandins({ photoId, eventId: p.event_id, hash, toTile }, requestRender);
}

/**
 * Mark photos for re-render. The mark lives in the database, so a restart picks it up.
 * hold: withhold the current version until re-rendered (someone asked to be covered or forgotten).
 */
export async function rerender(ids: string[], hold = false) {
  await markStale(sql, ids, hold);
  requestRenders(ids);
}
type Q = typeof sql | postgres.TransactionSql;
/** The mark alone, so a route can write it in the same transaction as the change that needs it. */
export async function markStale(q: Q, ids: string[], hold: boolean) {
  if (!ids.length) return;
  // Millisecond precision: render() reads the mark back as a JS Date and clears it only if unchanged.
  await q`update photos set stale_at = date_trunc('milliseconds', clock_timestamp()), hold = hold or ${hold} where id = any(${ids}::uuid[])`;
}
export function requestRenders(ids: string[]) { for (const id of ids) requestRender(id); }
/**
 * After a guest's change commits: mark anything that became affected while it was committing
 * (a render that started and read the old state is now in flight or has matched them), then render all.
 */
export async function settleGuestChange(guestId: string, eventId: string, before: string[], hold: boolean) {
  const late = (await photosOf(sql, guestId, eventId)).filter((id) => !before.includes(id));
  await markStale(sql, late, hold);
  requestRenders([...before, ...late]);
}
/** Marks that outlived their quick retries (an S3 or DB outage) are picked up again by the scheduler. */
export async function requeueStale() {
  for (const r of await sql`select id from photos where stale_at < now() - interval '10 minutes' and status not in ('processing', 'failed') limit 200`)
    if (!retries.has(r.id as string)) requestRender(r.id as string); // a pending retry timer already covers it
}
/** A selfie changed: any photo of the event may now match differently. */
export async function rerenderEvent(eventId: string) {
  const rows = await sql`select id from photos where event_id = ${eventId} and status in ('ready','review')`;
  await rerender(rows.map((r) => r.id as string));
}
/**
 * The photos a guest's change can affect: those they were matched in, plus any of the event's photos
 * being rendered right now (that render may have read the guest's old choice).
 */
export async function photosOf(q: Q, guestId: string, eventId: string) {
  const inFlight = [...renders.keys()];
  const rows = await q`select photo_id as id from photo_people where guest_id = ${guestId}
    union select id from photos where event_id = ${eventId} and id = any(${inFlight}::uuid[])`;
  return rows.map((r) => r.id as string);
}

/** Retry the vision check on photos where it failed. Called by the scheduler. */
export async function recheckFailedChecks() {
  if (!env.openrouterKey) return;
  // Random order, and a failure moves on: one photo the model always fails on must not block the rest.
  // At most 5 paid attempts per photo, spaced out by 2^n minutes, 3 per tick.
  const rows = await sql`update photos set check_attempts = check_attempts + 1, checked_at = now()
    where id in (select id from photos where status = 'review' and model_count is null and reviewed_at is null and check_attempts < 5
      and (checked_at is null or checked_at < now() - make_interval(mins => power(2, check_attempts)::int)) order by random() limit 3)
    returning id, original_key, regions`;
  for (const p of rows) {
    try {
      const original = await store.get(p.original_key);
      if (!original) continue;
      const n = await untiledFaces(await renderTiled(original, p.regions as Region[]));
      await sql`update photos set model_count = ${n}, needs_review = ${n > 0} where id = ${p.id}`;
      requestRender(p.id as string);
    } catch { continue; } // still failing: try again next tick
  }
}

export async function resumePending() {
  for (const r of await sql`select id from photos where status = 'processing'`) processPhoto(r.id as string);
  for (const r of await sql`select id from photos where stale_at is not null and status <> 'processing'`) requestRender(r.id as string);
}

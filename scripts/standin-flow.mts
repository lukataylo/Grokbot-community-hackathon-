// Free end-to-end run of AI stand-ins through the real pipeline and the local database, with OpenRouter stubbed
// in-process: the "model" returns the tiled image it was sent with a stranger's face (from bench.jpg) pasted over
// each tiled rectangle. Checks publish order, what the model is sent, pixels outside the rectangles, the cache,
// a guest switching to Cover me, switching back to tiles, a locked event, a misaligned answer (kept as tiles), an answer
// with no face where a face was (rejected), a photo the vision check flagged (never gets stand-ins), a stale claim, and
// the one-time match_v2 migration (withholds and re-renders matched photos, once, even with two boots at once).
// Usage: npx tsx --env-file=.env.local scripts/standin-flow.mts [out-dir]   (needs DATABASE_URL; spends nothing)
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { sql, migrate } from "../src/lib/db";
import * as store from "../src/lib/storage";
import { ingest, processPhoto, rerender, rerenderEvent, markStale, requestRenders, migrateMatching } from "../src/lib/pipeline";
import { selfieEmbedding, detectRegions, type Region } from "../src/lib/faces";
import { rectsFor, generate } from "../src/lib/standins";
import { tileRect } from "../src/lib/tiles";

process.env.OPENROUTER_API_KEY ||= "stub"; // env.ts reads it at import time, so set it on the command line to be sure
const OUT = process.argv[2];
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let passed = 0, failed = 0;
const check = (c: boolean, m: string) => { console.log(c ? "PASS" : "FAIL", m); if (c) passed++; else failed++; };

const bench = fs.readFileSync("e2e/fixtures/bench.jpg");
const stranger = (await detectRegions(bench)).regions.filter((r) => r.kind === "face")[0];
const sent: Buffer[] = [];
let photoId = "", misalign = false, blank = false, flagged = false;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (!String(url).startsWith("https://openrouter.ai/")) return realFetch(url, init);
  const body = JSON.parse(String(init?.body));
  if (!body.modalities) return Response.json({ choices: [{ message: { content: `{"visible_faces":${flagged ? 1 : 0},"where":""}` } }] }); // vision check
  const img = Buffer.from(body.messages[0].content[1].image_url.url.split(",")[1], "base64");
  sent.push(img);
  const m = (await sharp(img).metadata()) as { width: number; height: number };
  const regs: Region[] = (await sql`select regions from photos where id = ${photoId}`)[0].regions;
  const layers = [];
  const showing = new Set((await sql`select id from guests where choice = 'show'`).map((x) => x.id as string));
  for (const r of regs.filter((r) => !(r.guestId && showing.has(r.guestId)))) { // every tiled region, as render() decides
    const t = tileRect(r, m.width, m.height); if (!t) continue;
    const face = blank ? await sharp({ create: { width: t.ew, height: t.eh, channels: 3, background: { r: 205, g: 160, b: 135 } } }).png().toBuffer() : await sharp(bench).extract({ left: Math.max(0, Math.round(stranger.x - stranger.w * 0.25)), top: Math.max(0, Math.round(stranger.y - stranger.h * 0.35)), width: Math.round(stranger.w * 1.5), height: Math.round(stranger.h * 1.7) })
      .resize(t.ew, t.eh, { fit: "fill" }).png().toBuffer();
    layers.push({ input: face, left: t.ex, top: t.ey });
  }
  // Answer at 2/3 size, as image models often do. Misaligned: sharp resizes before compositing, so faces land shifted and scaled.
  const edited = misalign ? img : await sharp(img).composite(layers).png().toBuffer();
  const out = await sharp(edited).composite(misalign ? layers : []).resize(Math.round(m.width * 2 / 3), Math.round(m.height * 2 / 3)).png().toBuffer();
  return Response.json({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${out.toString("base64")}` } }] } }] });
}) as typeof fetch;

await migrate();
const stamp = Date.now().toString(36);
const [h] = await sql`insert into hosts (email) values (${`e2e+standin${stamp}@lumzel.test`}) returning id`;
const now = Date.now();
const [ev] = await sql`insert into events (slug, host_id, name, starts_at, ends_at, deliver_at, sharing_unlocked, face_style)
  values (${"sf" + stamp}, ${h.id}, 'Stand-in flow', ${new Date(now - 3600e3)}, ${new Date(now + 3600e3)}, ${new Date(now + 86400e3)}, true, 'standins') returning id`;
const emb = await selfieEmbedding(fs.readFileSync("e2e/fixtures/selfie.jpg"));
const [sam] = await sql`insert into guests (event_id, name, choice, embedding, resume_code) values (${ev.id}, 'Sam', 'show', ${emb as number[]}, ${"rc" + stamp}) returning id`;
const { buf, width, height } = await ingest(fs.readFileSync("e2e/fixtures/group.jpg"));
async function addPhoto() {
  const key = `e/${ev.id}/orig/${Date.now()}.jpg`; await store.put(key, buf);
  const [p] = await sql`insert into photos (event_id, by_host, original_key, width, height) values (${ev.id}, true, ${key}, ${width}, ${height}) returning id`;
  photoId = p.id as string;
  processPhoto(photoId);
}
type Row = Record<string, any>;
const row = async (): Promise<Row> => (await sql`select * from photos where id = ${photoId}`)[0];
const runs = async () => (await sql`select count(*)::int as n from standin_run where photo_id = ${photoId}`)[0].n as number;
const until = async (f: (r: Row) => boolean, ms = 60000) => { const t = Date.now(); for (;;) { const r = await row(); if (f(r)) return r; if (Date.now() - t > ms) throw new Error("timed out waiting"); await new Promise((x) => setTimeout(x, 300)); } };
const raw = (b: Buffer) => sharp(b).removeAlpha().raw().toBuffer();
const save = (name: string, b: Buffer) => OUT && fs.writeFileSync(path.join(OUT, name), b);

try {
  await addPhoto();
  const firstId = photoId;
  const first = await until((r) => r.status === "ready");
  const tiledPub = (await store.get(first.public_key))!;
  save("flow-1-tiled.jpg", tiledPub);
  check(!first.has_standins, `tiles published first (rev ${first.render_rev})`);
  const second = await until((r) => r.has_standins);
  const standPub = (await store.get(second.public_key))!;
  save("flow-2-standins.jpg", standPub);
  check(second.render_rev > first.render_rev, `stand-ins published afterwards as a new render_rev (${second.render_rev})`);
  check(sent.length === 1 && sent[0].equals(tiledPub), "the model was sent exactly the published tiled render, byte for byte");
  const regs: Region[] = second.regions;
  const samR = regs.find((r) => r.guestId === sam.id);
  check(!!samR, "the Show-me guest was matched and left untiled");
  const rects = rectsFor(regs.filter((r) => !r.guestId), width, height);
  const A = await raw(tiledPub), B = await raw(standPub);
  const near = (x: number, y: number) => rects.some((r) => x >= r.x - 16 && x < r.x + r.w + 16 && y >= r.y - 16 && y < r.y + r.h + 16);
  const maxDiff = (x0: number, y0: number, w: number, h: number) => { let mx = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { if (near(x, y)) continue; const i = (y * width + x) * 3; for (let c = 0; c < 3; c++) mx = Math.max(mx, Math.abs(A[i + c] - B[i + c])); } return mx; };
  const whole = maxDiff(0, 0, width, height);
  check(whole <= 8, `outside the tiled rectangles (16px JPEG margin) the stand-in version equals the tiles version up to re-encoding (max diff ${whole})`);
  if (samR) { const t = tileRect(samR, width, height)!; const d = maxDiff(t.ex, t.ey, t.ew, t.eh); check(d <= 8, `the Show-me guest's real face is untouched (max diff ${d})`); }
  check((await runs()) === 1, "one paid run claimed");

  await rerender([photoId]);
  const third = await until((r) => r.render_rev > second.render_rev && !r.stale_at);
  check(third.has_standins && (await runs()) === 1, "a re-render with the same tiled set reuses the cached stand-in, no new run");

  await sql.begin(async (tx) => { await tx`update guests set choice = 'cover' where id = ${sam.id}`; await markStale(tx, [photoId], true); });
  requestRenders([photoId]);
  const fourth = await until((r) => r.render_rev > third.render_rev && !r.hold && !r.stale_at);
  check(!fourth.has_standins && fourth.tile_set !== third.tile_set, "guest switches to Cover me: the new set publishes tiles, the old stand-in is not reused");
  const fifth = await until((r) => r.has_standins);
  check((await runs()) === 2 && sent.length === 2, "...then a new stand-in is made for the new set");
  save("flow-3-all-covered-standins.jpg", (await store.get(fifth.public_key))!);

  await sql`update events set face_style = 'tiles' where id = ${ev.id}`;
  await rerenderEvent(ev.id);
  const sixth = await until((r) => r.render_rev > fifth.render_rev && !r.stale_at);
  check(!sixth.has_standins, "switching the event back to tiles publishes plain tiles");

  await sql`update events set face_style = 'standins', sharing_unlocked = false where id = ${ev.id}`;
  await rerender([photoId]);
  const seventh = await until((r) => r.render_rev > sixth.render_rev && !r.stale_at);
  await new Promise((x) => setTimeout(x, 1500));
  check(!seventh.has_standins && (await runs()) === 2, "a locked event gets tiles and spends nothing");

  await sql`update events set sharing_unlocked = true where id = ${ev.id}`;
  misalign = true;
  await addPhoto();
  await until((r) => r.status === "ready");
  for (let t = Date.now(); Date.now() - t < 30000; await new Promise((x) => setTimeout(x, 300))) if ((await sql`select 1 from standin_run where photo_id = ${photoId} and outcome <> 'started'`).length) break;
  const [m] = await sql`select outcome from standin_run where photo_id = ${photoId}`;
  check(m?.outcome === "drift" && !(await row()).has_standins, `a misaligned model answer is rejected and the photo keeps its tiles (${m?.outcome})`);

  const lastRun = async () => { for (let t = Date.now(); Date.now() - t < 30000; await new Promise((x) => setTimeout(x, 300))) if ((await sql`select 1 from standin_run where photo_id = ${photoId} and outcome <> 'started'`).length) break; return (await sql`select outcome from standin_run where photo_id = ${photoId}`)[0]?.outcome; };

  // A model answer with no detectable face where a covered face was: the likeness check can't run, so rejected.
  misalign = false; blank = true;
  await addPhoto();
  await until((r) => r.status === "ready");
  const o = await lastRun();
  check(o === "identity" && !(await row()).has_standins, `a model answer with no face in a replaced face region is rejected (${o})`);
  blank = false;

  // A claim against a version that is no longer the published one spends nothing.
  const cur = await row();
  const runsBefore = await runs();
  const toTileNow = (cur.regions as Region[]).filter((r) => !r.guestId);
  const tiledNow = (await store.get(cur.public_key))!;
  check(await generate(photoId, ev.id, cur.tile_set, tiledNow, toTileNow, "e/stale-version.jpg") === "capped" && (await runs()) === runsBefore, "a claim for a superseded public version is refused, no run");
  await sql`update photos set hold = true where id = ${photoId}`;
  check(await generate(photoId, ev.id, cur.tile_set, tiledNow, toTileNow, cur.public_key) === "capped" && (await runs()) === runsBefore, "a claim for a held photo is refused, no run");
  await sql`update photos set hold = false where id = ${photoId}`;

  // A photo the vision check flagged goes to review; once a person approves it, it publishes tiles, never stand-ins.
  flagged = true;
  await addPhoto();
  const rv = await until((r) => r.status === "review");
  flagged = false;
  check(rv.model_count === 1 && (await runs()) === 0, "a flagged photo waits in review with no stand-in run");
  await sql`update photos set status = 'review', reviewed_at = now(), needs_review = false where id = ${photoId}`; // as review/route.ts approve
  await rerender([photoId]);
  const ap = await until((r) => r.status === "ready" && r.render_rev > rv.render_rev && !r.stale_at);
  await new Promise((x) => setTimeout(x, 2000));
  check(!ap.has_standins && (await runs()) === 0, "after approval it publishes tiles and no stand-in is generated");

  // One-time migration: photos with a matched guest are withheld and re-rendered under the current rule, exactly once.
  photoId = firstId;
  const pre = await row();
  check(pre.regions.some((r: Region) => r.guestId), "the first photo has a matched guest region");
  await sql`delete from migrations where name = 'match_v2'`;
  await Promise.all([migrateMatching(), migrateMatching()]); // two boots at once
  const held = await row();
  check(held.hold && !!held.stale_at, "match_v2 withholds a matched photo and marks it for re-render");
  check((await sql`select count(*)::int as n from migrations where name = 'match_v2'`)[0].n === 1, "the marker is written once");
  const redone = await until((r) => !r.hold && !r.stale_at && r.render_rev > pre.render_rev);
  check(redone.status === "ready", `it is re-rendered and published again (rev ${pre.render_rev} -> ${redone.render_rev})`);
  await migrateMatching();
  const again = await row();
  check(!again.hold && !again.stale_at && again.render_rev === redone.render_rev, "a later boot does nothing (marker present)");
} catch (e) { check(false, (e as Error).message); }
finally {
  for (const c of await sql`select c.key from standin_cache c join photos p on p.id = c.photo_id where p.event_id = ${ev.id}`) await store.del(c.key as string);
  for (const p of await sql`select original_key, public_key from photos where event_id = ${ev.id}`) { await store.del(p.original_key as string); if (p.public_key) await store.del(p.public_key as string); }
  await sql`delete from hosts where id = ${h.id}`;
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);

// Proves the stand-in compositor only changes pixels renderTiled tiled (never a rectangle's untiled corners). No paid call: the "model output"
// is a solid colour (at another resolution, same aspect), plus a hostile overlay that tries to paint everywhere.
// Usage: npx tsx scripts/standin-check.mts [image.jpg] [regions.json] [out-dir]
// Without regions.json, faces are detected locally (as the pipeline does) and everyone is tiled.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { renderTiled } from "../src/lib/tiles";
import { detectRegions, assignMatches, MATCH_THRESHOLD, type Region } from "../src/lib/faces";
import { rectsFor, maskFor, overlayFrom, composite, countOutsideDiffs, setHash, newFaces, DISCLOSURE, JPEG_OPTS } from "../src/lib/standins";
import { ingest } from "../src/lib/pipeline";

const [file = "e2e/fixtures/group.jpg", regionsFile, outDir] = process.argv.slice(2);
let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}: ${what}`); if (!ok) failed++; };

// The source carries GPS and a camera description, which must never reach a published stand-in.
const withGps = await sharp(fs.readFileSync(file)).withExif({ IFD0: { ImageDescription: "SECRET-CAMERA-NOTE" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } }).jpeg({ quality: 92 }).toBuffer();
const original = (await ingest(withGps)).buf;
const regions: Region[] = regionsFile ? JSON.parse(fs.readFileSync(regionsFile, "utf8")) : (await detectRegions(original)).regions;
const tiled = await renderTiled(original, regions);
const { width, height } = (await sharp(tiled).metadata()) as { width: number; height: number };
const rects = rectsFor(regions, width, height);
console.log(`${file}: ${width}x${height}, ${regions.length} regions, ${rects.length} tiled rectangles, set ${setHash(regions)}`);
check(rects.length > 0, "at least one tiled rectangle to test");
const raw = (b: Buffer) => sharp(b).removeAlpha().raw().toBuffer();
const tiledRaw = await raw(tiled);

// 1. A solid magenta "model output" at 60% size: resized up, pasted inside the rectangles only.
const fake = await sharp({ create: { width: Math.round(width * 0.6), height: Math.round(height * 0.6), channels: 3, background: { r: 255, g: 0, b: 255 } } }).png().toBuffer();
const out = await composite(tiled, await overlayFrom(fake, rects, width, height), rects);
check(countOutsideDiffs(tiledRaw, out.raw, rects, width, height) === 0, "every pixel outside the rectangles is byte-identical to the tiled render (raw)");
const mask = maskFor(rects, width, height);
let insideMagenta = 0, insideTotal = 0;
for (let p = 0; p < width * height; p++) {
  if (mask[p] < 1) continue;
  const i = p * 3; insideTotal++;
  if (out.raw[i] === 255 && out.raw[i + 1] === 0 && out.raw[i + 2] === 255) insideMagenta++;
}
check(insideTotal > 0 && insideMagenta === insideTotal, `the tiled area's interior was replaced (${insideMagenta}/${insideTotal})`);
check(out.changes.length === rects.length && out.changes.every((c) => c > 4), `per-rectangle change measured for each rectangle (${out.changes.map((c) => c.toFixed(0)).join(", ")})`);

// 2. The published JPEG: outside pixels can only differ by re-encoding, never by model content.
const jpegRaw = await raw(out.jpeg);
const reenc = await raw(await sharp(tiledRaw, { raw: { width, height, channels: 3 } }).jpeg(JPEG_OPTS).toBuffer());
let maxDiff = 0, sum = 0, n = 0, maxVsReenc = 0;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  if (rects.some((r) => x >= r.x - 16 && x < r.x + r.w + 16 && y >= r.y - 16 && y < r.y + r.h + 16)) continue; // JPEG blocks touching an edge
  const i = (y * width + x) * 3;
  for (let c = 0; c < 3; c++) { const d = Math.abs(jpegRaw[i + c] - tiledRaw[i + c]); maxDiff = Math.max(maxDiff, d); sum += d; n++; maxVsReenc = Math.max(maxVsReenc, Math.abs(jpegRaw[i + c] - reenc[i + c])); }
}
console.log(`  published JPEG vs tiled render, outside (16px margin): max ${maxDiff}, mean ${(sum / n).toFixed(3)}; vs re-encoding the tiled render alone: max ${maxVsReenc}`);
check(maxVsReenc === 0, "outside the rectangles the published JPEG equals a plain re-encode of the tiled render (no magenta leaks)");

// 3. A hostile overlay (opaque magenta everywhere) is still clipped to the current rectangles.
const hostile = Buffer.alloc(width * height * 4); for (let i = 0; i < width * height; i++) { hostile[i * 4] = 255; hostile[i * 4 + 2] = 255; hostile[i * 4 + 3] = 255; }
const out2 = await composite(tiled, hostile, rects);
check(countOutsideDiffs(tiledRaw, out2.raw, rects, width, height) === 0, "a full-frame overlay still changes nothing outside the tiled area");
// 3b. Rectangle corners outside the tiled ellipse (where a Show-me neighbour may stand) are never touched.
let corners = 0, cornerDiffs = 0;
for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
  const p = y * width + x; if (mask[p] > 0) continue; corners++;
  for (const o of [out.raw, out2.raw]) if (o[p * 3] !== tiledRaw[p * 3] || o[p * 3 + 1] !== tiledRaw[p * 3 + 1] || o[p * 3 + 2] !== tiledRaw[p * 3 + 2]) cornerDiffs++;
}
check(corners > 0 && cornerDiffs === 0, `untiled rectangle corners unchanged by a magenta or full-frame overlay (${corners} corner pixels, ${cornerDiffs} changed)`);

// 4. A model answer with another aspect ratio is refused (the caller keeps tiles).
const wide = await sharp({ create: { width: Math.round(width * 1.1), height, channels: 3, background: "#f0f" } }).png().toBuffer();
check(await overlayFrom(wide, rects, width, height).then(() => false, (e) => /^aspect/.test(e.message)), "a model image with a different aspect ratio is refused");

// 5. Removing one region from the set changes the cache key.
check(regions.length < 2 || setHash(regions) !== setHash(regions.slice(1)), "a changed tiled set gets a new cache key");

// 6. Published JPEG metadata: the AI disclosure, and nothing of the original's EXIF (no GPS, no camera note).
const meta = await sharp(out.jpeg).metadata();
const exif = meta.exif?.toString("latin1") ?? "", xmp = meta.xmp?.toString("utf8") ?? "";
check(exif.includes(DISCLOSURE), "EXIF ImageDescription carries the AI stand-in disclosure");
check(xmp.includes("compositeWithTrainedAlgorithmicMedia") && xmp.includes(DISCLOSURE), "XMP carries IPTC DigitalSourceType compositeWithTrainedAlgorithmicMedia and the disclosure");
check(!ifd0Tags(meta.exif).includes(0x8825) && !exif.includes("SECRET-CAMERA-NOTE") && !meta.icc && !meta.iptc, `no GPS IFD or original metadata in the output (IFD0 tags: ${ifd0Tags(meta.exif).map((t) => t.toString(16)).join(",")})`);
check(ifd0Tags((await sharp(withGps).metadata()).exif).includes(0x8825) && !(await sharp(original).metadata()).exif, "the test source had a GPS IFD, and ingest strips the original's EXIF");
function ifd0Tags(b?: Buffer): number[] {
  if (!b) return [];
  const t = b.subarray(b.indexOf("II") >= 0 && b.indexOf("II") < 8 ? b.indexOf("II") : b.indexOf("MM"));
  const le = t[0] === 0x49, u16 = (o: number) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o)), u32 = (o: number) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  const off = u32(4), n = u16(off);
  return Array.from({ length: n }, (_, k) => u16(off + 2 + k * 12));
}

// 7. Matching is ambiguity-safe both ways (scores[face][guest], synthetic).
const T = MATCH_THRESHOLD;
check(JSON.stringify(assignMatches([[0.95, 0.3], [0.2, 0.92]])) === "[0,1]", "two clear matches are paired");
check(assignMatches([[T - 0.01]])[0] === null, `a score just under ${T} stays tiled`);
check(assignMatches([[0.95, 0.88]])[0] === null, "a face that looks like two guests stays tiled");
check(JSON.stringify(assignMatches([[0.95], [0.9]])) === "[null,null]", "a guest with a lookalike in the photo (two faces >= threshold, within margin) matches neither");
check(JSON.stringify(assignMatches([[0.95], [0.7]])) === "[0,null]", "a guest's second face below the threshold doesn't block their best");
check(JSON.stringify(assignMatches([[0.95, 0.4], [0.9, 0.86]])) === "[null,null]", "a lookalike can't fall through to a weaker guest either");

// 8. Identity check fails closed per rectangle (synthetic detector on the real composite).
const faceRegs = regions.filter((r) => r.kind === "face" && r.embedding?.length);
if (faceRegs.length) {
  const one = [faceRegs[0]], e = faceRegs[0].embedding!;
  const t0 = rectsFor(one, width, height)[0];
  const centred = (embedding?: number[]) => async () => [{ x: t0.w * 0.3 + Math.round(t0.w * 0.3) - t0.w * 0.1, y: t0.h * 0.3 + Math.round(t0.h * 0.3) - t0.h * 0.1, w: t0.w * 0.2, h: t0.h * 0.2, score: 0.9, embedding }];
  const rejects = (p: Promise<unknown>) => p.then(() => false, (err) => /^identity/.test(err.message));
  check(await rejects(newFaces(out.raw, width, height, one, async () => [])), "a replaced face region where no face is detected is rejected");
  check(await rejects(newFaces(out.raw, width, height, one, centred(undefined))), "a replaced face region whose new face has no embedding is rejected");
  check(await rejects(newFaces(out.raw, width, height, one, async () => [...(await centred(e)()), ...(await centred(e)())])), "a replaced face region with two new faces is rejected");
  check((await newFaces(out.raw, width, height, one, centred(e))).length === 1, "exactly one new face with an embedding is accepted for the likeness check");
  const head: Region = { ...faceRegs[0], kind: "head", embedding: undefined };
  check((await newFaces(out.raw, width, height, [head], async () => [])).length === 0, "a head region (no original embedding) may come back without a face");
  check(await rejects(newFaces(out.raw, width, height, [head], centred(undefined))), "a head region whose detected face lacks an embedding is rejected");
} else check(false, "fixture has a face region with an embedding");

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "check-tiled.jpg"), tiled);
  fs.writeFileSync(path.join(outDir, "check-composite.jpg"), out.jpeg);
  console.log(`  wrote ${outDir}/check-tiled.jpg and check-composite.jpg`);
}
console.log(failed ? `${failed} check(s) failed` : "All checks passed");
process.exit(failed ? 1 : 0);

// Proves the stand-in compositor only changes pixels inside the tiled rectangles. No paid call: the "model output"
// is a solid colour (at another resolution, same aspect), plus a hostile overlay that tries to paint everywhere.
// Usage: npx tsx scripts/standin-check.mts [image.jpg] [regions.json] [out-dir]
// Without regions.json, faces are detected locally (as the pipeline does) and everyone is tiled.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { renderTiled } from "../src/lib/tiles";
import { detectRegions, type Region } from "../src/lib/faces";
import { rectsFor, overlayFrom, composite, countOutsideDiffs, setHash, JPEG_OPTS } from "../src/lib/standins";

const [file = "e2e/fixtures/group.jpg", regionsFile, outDir] = process.argv.slice(2);
let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}: ${what}`); if (!ok) failed++; };

const original = await sharp(fs.readFileSync(file)).rotate().jpeg({ quality: 90 }).toBuffer();
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
let insideMagenta = 0, insideTotal = 0;
for (const r of rects) for (let y = r.y + 6; y < r.y + r.h - 6; y++) for (let x = r.x + 6; x < r.x + r.w - 6; x++) {
  const i = (y * width + x) * 3; insideTotal++;
  if (out.raw[i] === 255 && out.raw[i + 1] === 0 && out.raw[i + 2] === 255) insideMagenta++;
}
check(insideTotal > 0 && insideMagenta === insideTotal, `the rectangles' interiors were replaced (${insideMagenta}/${insideTotal})`);

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
check(countOutsideDiffs(tiledRaw, out2.raw, rects, width, height) === 0, "a full-frame overlay still changes nothing outside the rectangles");

// 4. A model answer with another aspect ratio is refused (the caller keeps tiles).
const wide = await sharp({ create: { width: Math.round(width * 1.1), height, channels: 3, background: "#f0f" } }).png().toBuffer();
check(await overlayFrom(wide, rects, width, height).then(() => false, (e) => /^aspect/.test(e.message)), "a model image with a different aspect ratio is refused");

// 5. Removing one region from the set changes the cache key.
check(regions.length < 2 || setHash(regions) !== setHash(regions.slice(1)), "a changed tiled set gets a new cache key");

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "check-tiled.jpg"), tiled);
  fs.writeFileSync(path.join(outDir, "check-composite.jpg"), out.jpeg);
  console.log(`  wrote ${outDir}/check-tiled.jpg and check-composite.jpg`);
}
console.log(failed ? `${failed} check(s) failed` : "All checks passed");
process.exit(failed ? 1 : 0);

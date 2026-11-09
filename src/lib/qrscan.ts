import sharp from "sharp";
import jsQR from "jsqr";

// Phones see the code small, far away and slightly out of focus, so a candidate has to decode at
// several sizes and under a little blur. jsQR alone is stricter than most phone scanners.
const SIZES = [1024, 640, 420, 300];

async function decodeAt(img: Buffer, width: number, blur = 0) {
  let p = sharp(img).flatten({ background: "#ffffff" }).resize({ width });
  if (blur) p = p.blur(blur);
  const { data, info } = await p.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)?.data ?? null;
}

/** Every distinct payload the image decodes to across the test variants. */
export async function decodeAll(img: Buffer): Promise<string[]> {
  const found = new Set<string>();
  for (const w of SIZES) { const d = await decodeAt(img, w); if (d) found.add(d); }
  const b = await decodeAt(img, 640, 1.2); if (b) found.add(b);
  return [...found];
}

/** True when at least 4 of the 5 variants decode to exactly `url`: one lucky size isn't good enough for a room of phones. */
export async function scansAs(img: Buffer, url: string): Promise<boolean> {
  let ok = 0;
  for (const w of SIZES) if ((await decodeAt(img, w)) === url) ok++;
  if ((await decodeAt(img, 640, 1.2)) === url) ok++;
  return ok >= 4;
}

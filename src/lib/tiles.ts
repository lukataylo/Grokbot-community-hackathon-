import sharp from "sharp";
import type { Region } from "./faces";

export type TileRect = { ex: number; ey: number; ew: number; eh: number; w: number; h: number; block: number; cols: number; rows: number };

/**
 * The rectangle a region's tiles are drawn in, clipped to the image (null when too small to tile).
 * Stand-ins (standins.ts) may change pixels only inside these same rectangles.
 */
export function tileRect(r: Region, width: number, height: number): TileRect | null {
  // Grow faces to take in hair and ears; head estimates are already generous.
  const gx = r.kind === "face" ? 1.5 : 1.15, gy = r.kind === "face" ? 1.7 : 1.15;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - (r.kind === "face" ? r.h * 0.08 : 0);
  let w = r.w * gx, h = r.h * gy;
  const block = Math.max(8, Math.round(Math.max(w, h) / 9));
  const cols = Math.max(3, Math.ceil(w / block)), rows = Math.max(3, Math.ceil(h / block));
  w = cols * block; h = rows * block;
  const left = Math.round(cx - w / 2), top = Math.round(cy - h / 2);
  const ex = Math.max(0, left), ey = Math.max(0, top);
  const ew = Math.min(width, left + w) - ex, eh = Math.min(height, top + h) - ey;
  if (ew < 4 || eh < 4) return null;
  return { ex, ey, ew, eh, w, h, block, cols, rows };
}

/** The tile grid actually drawn: gc x gr blocks from the rectangle's corner, each drawn only if its centre is in the ellipse. */
export function tileGrid(t: TileRect) {
  const gc = Math.max(1, Math.round((t.ew / t.w) * t.cols)), gr = Math.max(1, Math.round((t.eh / t.h) * t.rows));
  const rx = t.ew / 2, ry = t.eh / 2;
  const drawn = (i: number, j: number) => {
    const dx = (i * t.block + t.block / 2 - rx) / rx, dy = (j * t.block + t.block / 2 - ry) / ry;
    return dx * dx + dy * dy <= 1.08;
  };
  return { gc, gr, drawn };
}

/**
 * Burns soft tiles into every region: a coarse mosaic of rounded squares, averaged per block,
 * fading out in an ellipse around the head. Baked into the pixels, never an overlay.
 */
export async function renderTiled(original: Buffer, regions: Region[]): Promise<Buffer> {
  const img = sharp(original);
  const { width = 0, height = 0 } = await img.metadata();
  const layers: import("sharp").OverlayOptions[] = [];

  for (const r of regions) {
    const t = tileRect(r, width, height);
    if (!t) continue;
    const { ex, ey, ew, eh, w, h, block, cols, rows } = t;

    // Average colour per block (area-averaged downscale, then a light blur so no block keeps a feature).
    const { data } = await sharp(original)
      .extract({ left: ex, top: ey, width: ew, height: eh })
      .resize(Math.max(1, Math.round((ew / w) * cols)), Math.max(1, Math.round((eh / h) * rows)), { fit: "fill", kernel: "linear" })
      .blur(0.4).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { gc, gr, drawn } = tileGrid(t);
    let mr = 0, mg = 0, mb = 0;
    for (let i = 0; i < gc * gr; i++) { mr += data[i * 3]; mg += data[i * 3 + 1]; mb += data[i * 3 + 2]; }
    const n = gc * gr; const bg = [mr / n, mg / n, mb / n].map((v) => Math.round(v * 0.45 + 236 * 0.55));

    const gap = Math.max(1, Math.round(block * 0.08)), rad = Math.round(block * 0.2);
    let rects = "";
    for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
      const bx = i * block, by = j * block;
      if (!drawn(i, j)) continue;
      const k = (j * gc + i) * 3;
      rects += `<rect x="${bx}" y="${by}" width="${block}" height="${block}" fill="rgb(${bg.join(",")})"/>`;
      rects += `<rect x="${bx + gap}" y="${by + gap}" width="${block - gap * 2}" height="${block - gap * 2}" rx="${rad}" fill="rgb(${data[k]},${data[k + 1]},${data[k + 2]})"/>`;
    }
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ew}" height="${eh}">${rects}</svg>`), left: ex, top: ey });
  }

  return sharp(original).composite(layers).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

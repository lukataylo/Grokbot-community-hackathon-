import util from "util";
import path from "path";
import sharp from "sharp";

// tfjs-node 4.x calls util helpers that newer Node removed.
const u = util as unknown as Record<string, unknown>;
if (!u.isNullOrUndefined) u.isNullOrUndefined = (v: unknown) => v === null || v === undefined;
if (!u.isArray) u.isArray = Array.isArray;

export type Region = { x: number; y: number; w: number; h: number; kind: "face" | "head"; score: number; embedding?: number[]; guestId?: string | null };

type HumanT = {
  load: () => Promise<void>;
  detect: (t: unknown) => Promise<{ face: Array<{ box: number[]; score: number; embedding?: number[] }>; body: Array<{ score: number; keypoints: Array<{ part: string; position: number[]; score: number }> }> }>;
  tf: { node: { decodeImage: (b: Buffer, c: number) => { dispose: () => void } } };
  match: { similarity: (a: number[], b: number[], o?: unknown) => number };
};

let human: Promise<HumanT> | null = null;
function getHuman(): Promise<HumanT> {
  if (!human) {
    human = (async () => {
      await import("@tensorflow/tfjs-node");
      const mod = (await import("@vladmandic/human")) as unknown as { default: unknown };
      const Human = ((mod.default as { default?: unknown }).default ?? mod.default) as new (c: unknown) => HumanT;
      const h = new Human({
        modelBasePath: "file://" + path.join(process.cwd(), "models") + "/",
        backend: "tensorflow", debug: false, cacheSensitivity: 0, filter: { enabled: false },
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 100, minConfidence: 0.15, iouThreshold: 0.3, return: false },
          mesh: { enabled: true }, iris: { enabled: false }, description: { enabled: true },
          emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false },
        },
        body: { enabled: true, modelPath: "movenet-multipose.json", maxDetected: 30, minConfidence: 0.12 },
        hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
      });
      await h.load();
      return h;
    })();
  }
  return human;
}

async function run(h: HumanT, buf: Buffer) {
  const t = h.tf.node.decodeImage(buf, 3);
  try { return await h.detect(t); } finally { t.dispose(); }
}

const overlap = (a: Region, b: Region) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return i / Math.min(a.w * a.h, b.w * b.h);
};

const HEAD = ["nose", "leftEye", "rightEye", "leftEar", "rightEar"];

/** Every face and head in a photo, in the photo's own pixel coordinates. Biased towards recall. */
export async function detectRegions(input: Buffer): Promise<{ regions: Region[]; width: number; height: number }> {
  const h = await getHuman();
  const img = sharp(input);
  const { width = 0, height = 0 } = await img.metadata();
  const faces: Region[] = [];
  const heads: Region[] = [];

  // Full frame plus overlapping 60% crops, so small faces in wide group shots still reach detector resolution.
  const crops: Array<[number, number, number, number]> = [[0, 0, width, height]];
  const cw = Math.round(width * 0.6), ch = Math.round(height * 0.6);
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 1]) crops.push([Math.round((width - cw) * fx), Math.round((height - ch) * fy), cw, ch]);

  for (const [i, [x, y, w, hh]] of crops.entries()) {
    const buf = i === 0 ? await sharp(input).jpeg().toBuffer() : await sharp(input).extract({ left: x, top: y, width: w, height: hh }).jpeg().toBuffer();
    const r = await run(h, buf);
    for (const f of r.face) faces.push({ x: f.box[0] + x, y: f.box[1] + y, w: f.box[2], h: f.box[3], kind: "face", score: f.score, embedding: f.embedding ? Array.from(f.embedding) : undefined });
    if (i === 0) {
      for (const b of r.body) {
        const pts = b.keypoints.filter((k) => HEAD.includes(k.part) && k.score > 0.25);
        if (pts.length < 2) continue;
        const xs = pts.map((p) => p.position[0]), ys = pts.map((p) => p.position[1]);
        const cx = xs.reduce((a, c) => a + c, 0) / xs.length, cy = ys.reduce((a, c) => a + c, 0) / ys.length;
        const sh = b.keypoints.filter((k) => /Shoulder/.test(k.part) && k.score > 0.3).map((k) => k.position[0]);
        const span = Math.max(Math.max(...xs) - Math.min(...xs), 1);
        const shoulder = sh.length === 2 ? Math.abs(sh[0] - sh[1]) : 0;
        const size = Math.max(span * 1.9, shoulder * 0.55, width * 0.03);
        heads.push({ x: cx - size / 2, y: cy - size * 0.62, w: size, h: size * 1.25, kind: "head", score: b.score });
      }
    }
  }

  // Non-max suppression over faces (keep the most confident, which also keeps its embedding).
  faces.sort((a, b) => b.score - a.score);
  const kept: Region[] = [];
  for (const f of faces) if (!kept.some((k) => overlap(k, f) > 0.4)) kept.push(f);
  // A head with no face on it is someone we cannot identify: it will always be tiled.
  for (const hd of heads) if (!kept.some((k) => overlap(k, hd) > 0.15)) kept.push(hd);

  return { regions: kept.map((r) => ({ ...r, x: Math.max(0, r.x), y: Math.max(0, r.y) })), width, height };
}

/**
 * The embedding of the one face in a selfie, null if none, "several" if more than one clear face
 * (a group photo would let a guest claim, and un-tile, someone else). The image itself is never stored.
 */
export async function selfieEmbedding(input: Buffer): Promise<number[] | null | "several"> {
  const h = await getHuman();
  const buf = await sharp(input).rotate().resize({ width: 1024, height: 1024, fit: "inside" }).jpeg().toBuffer();
  const r = await run(h, buf);
  const faces = r.face.filter((x) => x.embedding?.length && x.score > 0.5).sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
  if (!faces.length) return null;
  // A second face at least a third the size of the main one is a second person, not someone far behind.
  if (faces[1] && faces[1].box[2] * faces[1].box[3] > (faces[0].box[2] * faces[0].box[3]) / 3) return "several";
  return Array.from(faces[0].embedding!);
}

export const MATCH_THRESHOLD = 0.6; // conservative: a weak match means tiled, never shown

export async function similarity(a: number[], b: number[]) {
  const h = await getHuman();
  return h.match.similarity(a, b);
}

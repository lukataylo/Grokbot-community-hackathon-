import QRCode from "qrcode";
import sharp from "sharp";
import { env } from "./env";
import { sql } from "./db";
import { chat, editImage, parseJson } from "./llm";
import { scansAs } from "./qrscan";

export const MAX_CANDIDATES = 3;
export const MAX_RUNS = 6; // per event; each run is up to MAX_CANDIDATES images at about $0.14 each
export const MAX_HOST_RUNS = 12; // per host across all events: events are free, so the event cap alone has no ceiling
// Whole service, last 24 hours (~$17 at the default). A bad value falls back to the default rather than disabling the cap.
export const DAILY_RUNS = Number.isFinite(Number(process.env.QR_ART_DAILY_RUNS)) && Number(process.env.QR_ART_DAILY_RUNS) > 0 ? Number(process.env.QR_ART_DAILY_RUNS) : 40;

type EventText = { name: string; description: string; venue: string; hosted_by: string };
/** The events columns this feature reads. */
export type QrEvent = EventText & { id: string; slug: string; host_id: string; qr_art_key: string | null; qr_art_runs: number };

// One per candidate, so the three options look different from each other.
const STYLES = ["ink and watercolour illustration", "moody cinematic night photograph", "bold papercut collage"];
const FALLBACK = [
  "a city skyline at night under a pale misty sky, ink and watercolour illustration",
  "a lantern-lit garden at dusk with deep shadows and soft white highlights, moody cinematic night photograph",
  "layered mountains and a pale dawn sky, bold papercut collage",
];

export const joinUrl = (slug: string) => `${env.baseUrl}/${slug}`;

export async function plainQrPng(url: string) {
  return QRCode.toBuffer(url, { type: "png", errorCorrectionLevel: "H", margin: 4, width: 1024, color: { dark: "#000000", light: "#ffffff" } });
}

/** One-line visual scenes from the event text, one per style. Falls back to generic scenes. */
export async function themesFor(ev: EventText): Promise<string[]> {
  const about = [ev.name, ev.description, ev.venue && `Venue: ${ev.venue}`, ev.hosted_by && `Hosted by: ${ev.hosted_by}`].filter(Boolean).join("\n").slice(0, 1500);
  try {
    const out = await chat(env.textModel, [
      { role: "system", content: `You write short visual scene descriptions for artwork. Return JSON {"themes": [string, string, string]}. Each theme is one line under 30 words describing a scene that evokes the event. Describe only the scene; don't name the style. No people's faces, no text or lettering, no brands or logos. Prefer scenes with pale skies or highlights and deep shadows.` },
      { role: "user", content: `Event:\n${about}\n\nStyles, in order: ${STYLES.join("; ")}` },
    ], { json: true, maxTokens: 400, temperature: 0.9, reasoning: "off" });
    const t = parseJson<{ themes?: unknown }>(out)?.themes;
    if (Array.isArray(t)) return FALLBACK.map((f, k) => (typeof t[k] === "string" && t[k].trim() ? `${t[k].trim().slice(0, 240)}, ${STYLES[k]}` : f));
  } catch (e) { console.warn("[qrart] themes", (e as Error).message); }
  return FALLBACK;
}

const prompt = (theme: string) =>
  `Transform this QR code into artwork: ${theme}. It MUST scan as a QR code. Keep the exact grid of modules and the three corner finder squares in exactly the same positions and sizes. Every LIGHT module must be very pale, close to white (use light skies, highlights, mist, paper). Every DARK module must be deep and dark (night, ink, shadows). Strong contrast everywhere. Keep a plain white border around the code. Square, no text, no logos.`;

export type Candidate = { theme: string; png: Buffer };

/** Generates candidates in parallel and keeps only those that decode to exactly `url`. Throws only if every model call failed. */
export async function generateCandidates(url: string, themes: string[]): Promise<{ passed: Candidate[]; failed: number }> {
  const base = `data:image/png;base64,${(await plainQrPng(url)).toString("base64")}`;
  const runs = await Promise.allSettled(themes.slice(0, MAX_CANDIDATES).map(async (theme) => {
    const img = await editImage(env.qrArtModel, prompt(theme), base);
    if (!img) throw new Error("no image returned");
    const png = await sharp(img, { limitInputPixels: 4096 * 4096 }).flatten({ background: "#ffffff" }).png().toBuffer();
    return { theme, png, ok: await scansAs(png, url) };
  }));
  const errors = runs.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  for (const e of errors) console.warn("[qrart] generate", (e.reason as Error)?.message);
  if (errors.length === runs.length) throw new Error("every image generation failed");
  const done = runs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  return { passed: done.filter((d) => d.ok).map(({ theme, png }) => ({ theme, png })), failed: done.filter((d) => !d.ok).length };
}

export type ArtState = { enabled: boolean; chosen: string | null; candidates: Array<{ id: string; theme: string }>; remaining: number };

/** What the dashboard needs to show the artistic QR picker. */
export async function artState(ev: { id: string; slug: string; host_id: string; qr_art_key: string | null; qr_art_runs: number }): Promise<ArtState> {
  const [{ hostRuns }] = await sql`select coalesce(sum(qr_art_runs), 0)::int as "hostRuns" from events where host_id = ${ev.host_id}`;
  const rows = await sql<{ id: string; key: string; theme: string }[]>`select id, key, theme from qr_art where event_id = ${ev.id} and url = ${joinUrl(ev.slug)} order by created_at desc limit 24`;
  return {
    enabled: !!env.openrouterKey,
    chosen: rows.find((r) => r.key === ev.qr_art_key)?.id ?? null,
    candidates: rows.map(({ id, theme }) => ({ id, theme })),
    remaining: Math.max(0, Math.min(MAX_RUNS - ev.qr_art_runs, MAX_HOST_RUNS - (hostRuns as number))),
  };
}

/** The chosen candidate's id, or null for the plain QR. Art made for an older join URL never shows. */
export async function chosenArtId(ev: { id: string; slug: string; qr_art_key: string | null }) {
  if (!ev.qr_art_key) return null;
  const [a] = await sql<{ id: string }[]>`select id from qr_art where event_id = ${ev.id} and key = ${ev.qr_art_key} and url = ${joinUrl(ev.slug)}`;
  return a?.id ?? null;
}

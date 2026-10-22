import type { Attendee, Photo, PhotoTag } from "./types";
import { mockBotAnswer, mockIdentify } from "./engine";

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const MODEL = process.env.XAI_MODEL ?? "grok-4";
const VISION_MODEL = process.env.XAI_VISION_MODEL ?? MODEL;

export const grokMode = (): "grok" | "mock" => (process.env.XAI_API_KEY ? "grok" : "mock");

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

async function chat(messages: { role: "system" | "user"; content: Content }[], model = MODEL): Promise<string> {
  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`xAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJSON<T>(text: string): T | null {
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

/**
 * Match people in a photo against the attendee roster using each person's
 * self-declared "look for" description. Consent is NOT applied here; the
 * caller filters so policy never depends on model output.
 */
export async function identifyPeople(
  photo: Photo,
  roster: Attendee[],
  imageDataUrl?: string,
): Promise<{ matches: PhotoTag[]; note: string }> {
  if (grokMode() === "grok" && imageDataUrl) {
    try {
      const list = roster.map((a) => `- id=${a.id} name=${a.name} looks like: ${a.lookFor}`).join("\n");
      const out = await chat(
        [
          { role: "system", content: "You match people in event photos to an attendee roster using their self-described appearance. Only match when confident. Reply with JSON only." },
          {
            role: "user",
            content: [
              { type: "text", text: `Roster:\n${list}\n\nReturn {"matches":[{"attendeeId":"...","confidence":0-1,"reason":"..."}],"note":"one-line scene description"}` },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        VISION_MODEL,
      );
      const parsed = parseJSON<{ matches: PhotoTag[]; note: string }>(out);
      if (parsed) return { matches: parsed.matches.filter((m) => roster.some((a) => a.id === m.attendeeId)), note: parsed.note };
    } catch (e) {
      console.error("Grok vision failed, falling back to mock", e);
    }
  }
  const svg = imageDataUrl?.startsWith("data:image/svg") ? Buffer.from(imageDataUrl.split(",")[1], "base64").toString("utf8") : undefined;
  return mockIdentify(photo, roster, svg);
}

/** Rewrite suggested post copy in each person's voice. Falls back to the template copy. */
export async function polishCopy(items: { id: string; who: string; type: string; platform: string; draft: string }[]): Promise<Record<string, string>> {
  if (grokMode() !== "grok" || items.length === 0) return {};
  try {
    const out = await chat([
      { role: "system", content: "You write short, authentic social posts for hackathon attendees. Keep @handles and hashtags. X posts under 260 chars. LinkedIn posts 2-3 sentences. Reply with JSON object mapping id to text." },
      { role: "user", content: JSON.stringify(items) },
    ]);
    return parseJSON<Record<string, string>>(out) ?? {};
  } catch (e) {
    console.error("Grok copy failed", e);
    return {};
  }
}

export async function botAnswer(question: string, context: string): Promise<string> {
  if (grokMode() === "grok") {
    try {
      return await chat([
        { role: "system", content: "You are Grokbot, co-organiser of a hackathon. Be brief, upbeat and concrete. Use the event context." },
        { role: "user", content: `Context:\n${context}\n\nOrganiser asks: ${question}` },
      ]);
    } catch (e) {
      console.error(e);
    }
  }
  return mockBotAnswer(context);
}

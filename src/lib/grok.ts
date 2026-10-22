import type { Attendee, DigestEvent, EventKit, KitData, KitKey, Photo, PhotoTag } from "./types";
import { mockBotAnswer, mockIdentify } from "./engine";
import { mockItem } from "./kit";

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
): Promise<{ matches: PhotoTag[]; note: string; place?: string; caption?: string }> {
  if (grokMode() === "grok" && imageDataUrl) {
    try {
      const list = roster.map((a) => `- id=${a.id} name=${a.name} looks like: ${a.lookFor}`).join("\n");
      const out = await chat(
        [
          { role: "system", content: "You match people in event photos to an attendee roster using their self-described appearance. Only match when confident. Reply with JSON only." },
          {
            role: "user",
            content: [
              { type: "text", text: `Roster:\n${list}\n\nReturn {"matches":[{"attendeeId":"...","confidence":0-1,"reason":"..."}],"note":"one-line scene description","place":"where in the venue, 1-3 words, e.g. Main stage, Hack floor, Kitchen","caption":"a short, warm photo caption, max 8 words"}` },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        VISION_MODEL,
      );
      const parsed = parseJSON<{ matches: PhotoTag[]; note: string; place?: string; caption?: string }>(out);
      if (parsed)
        return {
          matches: (parsed.matches ?? []).filter((m) => roster.some((a) => a.id === m.attendeeId)),
          note: parsed.note,
          place: typeof parsed.place === "string" ? parsed.place.slice(0, 30) : undefined,
          caption: typeof parsed.caption === "string" ? parsed.caption.slice(0, 60) : undefined,
        };
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

const str = (x: unknown, max = 5000) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : undefined);

const KIT_SYSTEM =
  "You are Grokbot, the copywriter for a London tech community. Write warm, specific, non-cringe event copy in British English. No buzzword soup, no exclamation spam, at most two emoji per post. Never invent facts that are not in the brief: use only the given name, date, venue, hosts, headcount, agenda and link. Reply with JSON only.";

function kitBrief(kit: EventKit) {
  const f = kit.facts;
  return JSON.stringify({
    idea: kit.idea,
    notes: kit.dump.slice(0, 2000),
    community: kit.brand.community,
    name: f.name,
    when: new Date(f.startsAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }),
    venue: f.venue,
    hosts: f.hosts,
    headcount: f.headcount,
    link: f.url ?? "link in bio",
    hashtag: f.hashtag,
    agenda: kit.items.page.data.agenda,
    lumaDescription: kit.lumaDescription?.slice(0, 1500),
  });
}

/**
 * Grok writes the copy (page, posts, newsletter subject and preheader). Timings, rota and
 * budget maths stay deterministic in code so a lead can trust them; the newsletter HTML and
 * visuals are re-rendered from Grok's page copy with the brand template.
 */
export async function grokWriteKit(kit: EventKit): Promise<EventKit> {
  if (grokMode() !== "grok") return kit;
  try {
    const out = await chat([
      { role: "system", content: KIT_SYSTEM },
      {
        role: "user",
        content: `Brief: ${kitBrief(kit)}\n\nReturn {"page":{"title":"","tagline":"max 8 words","description":"2-3 sentences","agenda":["4-5 short items"]},"linkedin":"","x":"max 260 chars incl. link and hashtag","whatsapp":"short, line breaks, *bold* allowed","discord":"markdown with ## heading","newsletterSubject":"","newsletterPreheader":""}`,
      },
    ]);
    const j = parseJSON<Record<string, unknown> & { page?: Record<string, unknown> }>(out);
    if (!j) return kit;
    const it = kit.items;
    const agenda = Array.isArray(j.page?.agenda) ? (j.page!.agenda as unknown[]).map((a) => str(a, 80)).filter((a): a is string => !!a).slice(0, 6) : [];
    it.page.data = {
      title: str(j.page?.title, 90) ?? it.page.data.title,
      tagline: str(j.page?.tagline, 90) ?? it.page.data.tagline,
      description: str(j.page?.description, 900) ?? it.page.data.description,
      agenda: agenda.length >= 3 ? agenda : it.page.data.agenda,
    };
    const post = (k: "linkedin" | "x" | "whatsapp" | "discord", max: number) => {
      const t = str(j[k], max);
      if (t) it[`post:${k}`].data = { text: t };
    };
    post("linkedin", 2800);
    post("x", 280);
    post("whatsapp", 1500);
    post("discord", 1900);
    // Re-render template-driven pieces from the new page copy.
    const nl = mockItem(kit, "newsletter", 0);
    it.newsletter.data = { ...nl, subject: str(j.newsletterSubject, 120) ?? nl.subject, preheader: str(j.newsletterPreheader, 160) ?? nl.preheader };
    for (const v of ["visual:square", "visual:story", "visual:banner", "visual:newsletter-header"] as const) it[v].data = { headline: it.page.data.title };
    kit.source = "grok";
  } catch (e) {
    console.error("Grok kit failed, keeping template drafts", e);
  }
  return kit;
}

/** Regenerate one piece. Copy goes back to Grok; everything else gets the next template variant. */
export async function regenerateKitItem<K extends KitKey>(kit: EventKit, key: K): Promise<KitData[K]> {
  const variant = kit.items[key].variant + 1;
  const fallback = mockItem(kit, key, variant);
  if (grokMode() !== "grok" || !(key.startsWith("post:") || key === "page" || key === "newsletter")) return fallback;
  try {
    const current = JSON.stringify(kit.items[key].data).slice(0, 3000);
    const out = await chat([
      { role: "system", content: KIT_SYSTEM },
      { role: "user", content: `Brief: ${kitBrief(kit)}\n\nThe lead rejected this ${key} draft: ${current}\nWrite a clearly different take with the same JSON shape. Return the JSON object only.` },
    ]);
    const j = parseJSON<Record<string, unknown>>(out);
    if (!j) return fallback;
    if (key.startsWith("post:")) {
      const t = str(j.text, key === "post:x" ? 280 : 2800);
      return (t ? { text: t } : fallback) as KitData[K];
    }
    if (key === "page") {
      const f = fallback as KitData["page"];
      const agenda = Array.isArray(j.agenda) ? (j.agenda as unknown[]).map((a) => str(a, 80)).filter((a): a is string => !!a) : [];
      return { title: str(j.title, 90) ?? f.title, tagline: str(j.tagline, 90) ?? f.tagline, description: str(j.description, 900) ?? f.description, agenda: agenda.length >= 3 ? agenda : f.agenda } as KitData[K];
    }
    const f = fallback as KitData["newsletter"];
    return { ...f, subject: str(j.subject, 120) ?? f.subject, preheader: str(j.preheader, 160) ?? f.preheader } as KitData[K];
  } catch (e) {
    console.error("Grok regenerate failed", e);
    return fallback;
  }
}

/** Turn a last-minute change into a short group announcement. */
export async function writeAnnouncement(change: string, eventName: string, mock: string): Promise<string> {
  if (grokMode() !== "grok") return mock;
  try {
    const out = await chat([
      { role: "system", content: "You write short, calm, clear last-minute updates for an event group chat. One or two sentences, one emoji max, include the concrete change. Plain text only." },
      { role: "user", content: `Event: ${eventName}\nChange: ${change}` },
    ]);
    return str(out, 600) ?? mock;
  } catch (e) {
    console.error(e);
    return mock;
  }
}

/** Draft the weekly digest newsletter intro and WhatsApp message from this week's events. */
export async function writeDigest(events: DigestEvent[], community: string): Promise<{ intro?: string; whatsapp?: string; subject?: string }> {
  if (grokMode() !== "grok" || !events.length) return {};
  try {
    const out = await chat([
      { role: "system", content: KIT_SYSTEM },
      { role: "user", content: `Community: ${community}\nThis week's events: ${JSON.stringify(events.slice(0, 15))}\nReturn {"subject":"","intro":"2 sentences for the newsletter","whatsapp":"short group message listing the events with day and time, *bold* names"}` },
    ]);
    const j = parseJSON<Record<string, unknown>>(out);
    return { subject: str(j?.subject, 120), intro: str(j?.intro, 600), whatsapp: str(j?.whatsapp, 1500) };
  } catch (e) {
    console.error(e);
    return {};
  }
}

/** Rewrite a personal recap in the attendee's voice, keeping only the given mentions. */
export async function writeRecap(draft: { x: string; linkedin: string }, context: string): Promise<{ x: string; linkedin: string }> {
  if (grokMode() !== "grok") return draft;
  try {
    const out = await chat([
      { role: "system", content: "You polish a hackathon attendee's personal recap posts. Keep every @handle, name and hashtag exactly, add no new people or facts. X under 260 chars, LinkedIn 3-5 short lines. Reply with JSON {\"x\":\"\",\"linkedin\":\"\"}." },
      { role: "user", content: `Context: ${context}\nDrafts: ${JSON.stringify(draft)}` },
    ]);
    const j = parseJSON<{ x?: string; linkedin?: string }>(out);
    return { x: str(j?.x, 280) ?? draft.x, linkedin: str(j?.linkedin, 2800) ?? draft.linkedin };
  } catch (e) {
    console.error(e);
    return draft;
  }
}

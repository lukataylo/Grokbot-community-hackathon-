import type { DB, Digest, DigestEvent } from "./types";
import { dayLabel, londonOffsetMs, timeLabel } from "./kit";

/** Weekly digest: this week's events from a Luma calendar .ics feed, drafted into a newsletter and group message. */

export const DEFAULT_CALENDAR = "cal-wUKLVX9VWOdVkpg";

export const icsUrl = (calendar: string) =>
  /^https?:\/\//.test(calendar) ? calendar : `https://api.lu.ma/ics/get?entity=calendar&id=${encodeURIComponent(calendar.trim())}`;

function icsDate(v: string) {
  // 20261022T180000Z, 20261022T180000 or 20261022
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
}

const unescapeIcs = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** Tiny iCalendar parser: unfolds lines and reads DTSTART, SUMMARY, LOCATION and URL per VEVENT. */
export function parseIcs(text: string): DigestEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out: DigestEvent[] = [];
  let cur: Partial<DigestEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      if (cur.start && cur.title) out.push({ start: cur.start, title: cur.title, location: cur.location ?? "", url: cur.url ?? "" });
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const name = line.slice(0, i).split(";")[0].toUpperCase();
      const value = line.slice(i + 1);
      if (name === "DTSTART") cur.start = icsDate(value) ?? undefined;
      else if (name === "SUMMARY") cur.title = unescapeIcs(value);
      else if (name === "LOCATION") cur.location = unescapeIcs(value);
      else if (name === "URL") cur.url = value.trim();
    }
  }
  return out;
}

export function thisWeek(events: DigestEvent[], now = Date.now()) {
  return events.filter((e) => {
    const t = new Date(e.start).getTime();
    return t >= now - 6 * 3600000 && t <= now + 7 * 86400000;
  }).sort((a, b) => a.start.localeCompare(b.start));
}

/** Used when the Luma feed can't be reached, so the demo still runs. Clearly labelled as a sample in the UI. */
export function sampleIcs(now = Date.now()) {
  const d = (days: number, h: number) => {
    const t = new Date(Math.floor(now / 86400000) * 86400000 + days * 86400000 + h * 3600000);
    return new Date(t.getTime() - londonOffsetMs(t)).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  };
  const ev = [
    [1, 18, "AI Agents Lab: Evals Night", "Expedite London HQ, 7 Lyric Square"],
    [2, 8, "Founders Breakfast: Fundraising in 2027", "Second Home Spitalfields"],
    [3, 18, "Supabase London Meetup", "Shoreditch Works"],
    [5, 11, "Build Club: Ship Something Small", "The Hack Collective Studio"],
    [6, 14, "Open Source Sprint: First PRs", "Imperial College, South Kensington"],
  ];
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...ev.flatMap(([days, h, title, loc], i) => ["BEGIN:VEVENT", `DTSTART:${d(days as number, h as number)}`, `SUMMARY:${title}`, `LOCATION:${loc}`, `URL:https://lu.ma/sample-${i + 1}`, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function mockDigest(calendar: string, feed: Digest["feed"], events: DigestEvent[], community: string, grok: { intro?: string; whatsapp?: string; subject?: string } = {}): Digest {
  const subject = grok.subject ?? `This week in ${community}: ${events.length} event${events.length === 1 ? "" : "s"}`;
  const intro = grok.intro ?? (events.length ? `Here's what's on this week. ${events[0].title} kicks things off on ${dayLabel(events[0].start).split(",")[0]}.` : "A quiet week. Perfect time to plan the next one.");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
<h1 style="font-size:24px;margin:0 0 8px">${esc(subject)}</h1>
<p style="font-size:15px;line-height:1.6;color:#444">${esc(intro)}</p>
${events.map((e) => `<div style="border-top:1px solid #eee;padding:12px 0"><p style="margin:0;font-size:13px;color:#888">${esc(dayLabel(e.start))} · ${timeLabel(e.start)}</p><p style="margin:2px 0;font-size:16px;font-weight:bold"><a href="${esc(e.url)}" style="color:#111">${esc(e.title)}</a></p><p style="margin:0;font-size:13px;color:#666">${esc(e.location)}</p></div>`).join("\n")}
</div>`;
  const whatsapp =
    grok.whatsapp ??
    `📅 *This week in ${community}*\n\n${events.map((e) => `• *${e.title}*: ${dayLabel(e.start).split(" ").slice(0, 2).join(" ")} ${timeLabel(e.start)}${e.location ? `, ${e.location.split(",")[0]}` : ""}\n  ${e.url}`).join("\n")}\n\nSee you there 👋`;
  return {
    calendar,
    feed,
    generatedAt: new Date().toISOString(),
    events,
    newsletter: { status: "draft", data: { subject, html }, variant: 0 },
    whatsapp: { status: "draft", data: { text: whatsapp }, variant: 0 },
  };
}

export function updateDigest(db: DB, part: "newsletter" | "whatsapp", patch: { status?: "draft" | "approved" | "sent"; text?: string; subject?: string }) {
  const d = db.digest;
  if (!d) return false;
  if (part === "whatsapp" && patch.text !== undefined) d.whatsapp.data.text = patch.text;
  if (part === "newsletter" && patch.subject !== undefined) d.newsletter.data.subject = patch.subject;
  if (patch.status) {
    d[part].status = patch.status;
    if (patch.status === "sent") d[part].sentAt = new Date().toISOString();
  }
  return true;
}

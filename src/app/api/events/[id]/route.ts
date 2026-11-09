import { sql } from "@/lib/db";
import { route, json, requireHostEvent, HttpError } from "@/lib/api";
import { EventInput } from "@/lib/eventInput";
import { schedule, fmt } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { ev } = await requireHostEvent((await params).id);
  const raw = (await req.json()) as Record<string, unknown>;
  // Zod applies defaults even under .partial(), so keep only the keys the client actually sent.
  const parsed = EventInput.partial().parse(raw) as Record<string, unknown>;
  const i = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in raw)) as Partial<EventInput>;

  if (i.date || i.start || i.end || i.deliver || i.timezone) {
    if (!(i.date && i.start && i.end)) throw new HttpError(400, "Send the date, start and end together");
    if (ev.delivered_at) throw new HttpError(409, "Photos have already been delivered");
    const tz = i.timezone ?? ev.timezone;
    const deliver = i.deliver ?? fmt(ev.deliver_at, ev.timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const s = schedule({ date: i.date, start: i.start, end: i.end, deliver, timezone: tz });
    if (s.deliverAt.getTime() < Date.now()) throw new HttpError(400, "That event has already finished. Pick today or a later date.");
    await sql`update events set starts_at = ${s.startsAt}, ends_at = ${s.endsAt}, deliver_at = ${s.deliverAt}, timezone = ${tz} where id = ${ev.id}`;
  }
  const cols: Record<string, unknown> = {
    name: i.name, hosted_by: i.hostedBy, venue: i.venue, linkedin_handle: i.linkedin?.replace(/^@/, ""),
    x_handle: i.x?.replace(/^@/, ""), hashtag: i.hashtag?.replace(/^#/, ""), caption_template: i.captionTemplate,
    description: i.description, highlights: i.highlights, uploads: i.uploads, retention_days: i.retentionDays,
  };
  const set = Object.fromEntries(Object.entries(cols).filter(([, v]) => v !== undefined));
  if (Object.keys(set).length) await sql`update events set ${sql(set)} where id = ${ev.id}`;
  return json({ ok: true });
});

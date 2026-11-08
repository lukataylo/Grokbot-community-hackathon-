import { sql } from "@/lib/db";
import { route, json, requireHostEvent } from "@/lib/api";
import { EventInput } from "@/lib/eventInput";
import { schedule } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { ev } = await requireHostEvent((await params).id);
  const i = EventInput.partial().parse(await req.json());
  const merged = { ...i };
  if (i.date && i.start && i.end) {
    const s = schedule({ date: i.date, start: i.start, end: i.end, deliver: i.deliver ?? "07:30", timezone: i.timezone ?? ev.timezone });
    if (!ev.delivered_at) await sql`update events set starts_at = ${s.startsAt}, ends_at = ${s.endsAt}, deliver_at = ${s.deliverAt} where id = ${ev.id}`;
  }
  const cols: Record<string, unknown> = {
    name: merged.name, hosted_by: merged.hostedBy, venue: merged.venue, linkedin_handle: merged.linkedin?.replace(/^@/, ""),
    x_handle: merged.x?.replace(/^@/, ""), hashtag: merged.hashtag?.replace(/^#/, ""), caption_template: merged.captionTemplate,
    description: merged.description, highlights: merged.highlights, review_mode: merged.reviewMode, uploads: merged.uploads,
    retention_days: merged.retentionDays, expected_guests: merged.expectedGuests,
  };
  const set = Object.fromEntries(Object.entries(cols).filter(([, v]) => v !== undefined));
  if (Object.keys(set).length) await sql`update events set ${sql(set)} where id = ${ev.id}`;
  return json({ ok: true });
});

import { sql } from "@/lib/db";
import { route, json, requireHost, HttpError } from "@/lib/api";
import { EventInput } from "@/lib/eventInput";
import { schedule } from "@/lib/time";
import { slugFrom } from "@/lib/ids";
import { canHost } from "@/lib/beta";

export const POST = route(async (req: Request) => {
  const h = await requireHost();
  if (!(await canHost(h.email))) throw new HttpError(403, "Creating events is in beta. Get access at lumzel.com.");
  const i = EventInput.parse(await req.json());
  const s = schedule(i);
  // Delivery runs as soon as its time passes, which also closes uploads: a past date would end the event at once.
  if (s.deliverAt.getTime() < Date.now()) throw new HttpError(400, "That event has already finished. Pick today or a later date.");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [ev] = await sql`insert into events (slug, host_id, name, hosted_by, venue, starts_at, ends_at, timezone, deliver_at,
          linkedin_handle, x_handle, hashtag, caption_template, description, highlights, uploads, retention_days)
        values (${slugFrom(i.name)}, ${h.id}, ${i.name}, ${i.hostedBy}, ${i.venue}, ${s.startsAt}, ${s.endsAt}, ${i.timezone}, ${s.deliverAt},
          ${i.linkedin.replace(/^@/, "")}, ${i.x.replace(/^@/, "")}, ${i.hashtag.replace(/^#/, "")}, ${i.captionTemplate}, ${i.description}, ${i.highlights}, ${i.uploads}, ${i.retentionDays})
        returning id, slug`;
      if (!h.name && i.hostedBy) await sql`update hosts set name = ${i.hostedBy} where id = ${h.id}`;
      return json(ev, 201);
    } catch (e) { if (!String((e as Error).message).includes("events_slug_key")) throw e; }
  }
  throw new Error("could not allocate a link");
});

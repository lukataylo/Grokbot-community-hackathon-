import { sql } from "@/lib/db";
import { route, json, requireHost } from "@/lib/api";
import { EventInput } from "@/lib/eventInput";
import { schedule } from "@/lib/time";
import { slugFrom } from "@/lib/ids";

export const POST = route(async (req: Request) => {
  const h = await requireHost();
  const i = EventInput.parse(await req.json());
  const s = schedule(i);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [ev] = await sql`insert into events (slug, host_id, name, hosted_by, venue, starts_at, ends_at, timezone, expected_guests, deliver_at,
          linkedin_handle, x_handle, hashtag, caption_template, description, highlights, review_mode, uploads, retention_days)
        values (${slugFrom(i.name)}, ${h.id}, ${i.name}, ${i.hostedBy}, ${i.venue}, ${s.startsAt}, ${s.endsAt}, ${i.timezone}, ${i.expectedGuests}, ${s.deliverAt},
          ${i.linkedin.replace(/^@/, "")}, ${i.x.replace(/^@/, "")}, ${i.hashtag.replace(/^#/, "")}, ${i.captionTemplate}, ${i.description}, ${i.highlights}, ${i.reviewMode}, ${i.uploads}, ${i.retentionDays})
        returning id, slug`;
      if (!h.name && i.hostedBy) await sql`update hosts set name = ${i.hostedBy} where id = ${h.id}`;
      return json(ev, 201);
    } catch (e) { if (!String((e as Error).message).includes("events_slug_key")) throw e; }
  }
  throw new Error("could not allocate a link");
});

export const GET = route(async () => {
  const h = await requireHost();
  const rows = await sql`select e.id, e.slug, e.name, e.starts_at, e.delivered_at, e.sharing_unlocked,
      (select count(*)::int from guests g where g.event_id = e.id) as guests,
      (select count(*)::int from photos p where p.event_id = e.id) as photos
    from events e where host_id = ${h.id} order by starts_at desc`;
  return json(rows);
});

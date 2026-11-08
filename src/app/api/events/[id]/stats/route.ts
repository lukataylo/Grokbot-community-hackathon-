import { sql } from "@/lib/db";
import { route, json, requireHostEvent } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { ev } = await requireHostEvent((await params).id);
  const [c] = await sql`select
      (select count(*)::int from guests where event_id = ${ev.id}) as guests,
      (select count(*)::int from guests where event_id = ${ev.id} and choice = 'cover') as cover,
      (select count(*)::int from guests where event_id = ${ev.id} and taggable) as taggable,
      (select count(*)::int from guests where event_id = ${ev.id} and push is not null) as notify,
      (select count(*)::int from photos where event_id = ${ev.id}) as photos,
      (select count(*)::int from photos where event_id = ${ev.id} and status = 'processing') as processing,
      (select coalesce(sum(tiled_count),0)::int from photos where event_id = ${ev.id}) as tiled,
      (select count(*)::int from guests where event_id = ${ev.id} and delivered_at is not null) as delivered,
      (select count(*)::int from posts where event_id = ${ev.id}) as posts,
      (select coalesce(sum(clicks),0)::int from shares where event_id = ${ev.id}) as clicks,
      (select coalesce(sum(previews),0)::int from shares where event_id = ${ev.id}) as previews,
      (select count(*)::int from cheers c join posts p on p.id = c.post_id where p.event_id = ${ev.id}) as cheers`;
  const review = await sql`select id, tiled_count, model_count, render_rev from photos where event_id = ${ev.id} and status = 'review' order by created_at limit 50`;
  const recent = await sql`select id, render_rev from photos where event_id = ${ev.id} and status = 'ready' order by created_at desc limit 12`;
  const leaders = await sql`select g.name, coalesce(sum(s.clicks),0)::int as clicks, count(distinct p.id)::int as posts,
      (select count(*)::int from cheers c join posts pp on pp.id = c.post_id where pp.guest_id = g.id) as cheers
    from guests g left join shares s on s.guest_id = g.id left join posts p on p.guest_id = g.id
    where g.event_id = ${ev.id} group by g.id having count(distinct s.code) > 0 or count(distinct p.id) > 0
    order by clicks desc, cheers desc limit 10`;
  const byHour = await sql`select date_trunc('hour', created_at) as h, count(*)::int as n from posts where event_id = ${ev.id} group by 1 order by 1`;
  return json({ counts: c, review, recent, leaders, byHour, event: { delivered_at: ev.delivered_at, deliver_at: ev.deliver_at, sharing_unlocked: ev.sharing_unlocked } });
});

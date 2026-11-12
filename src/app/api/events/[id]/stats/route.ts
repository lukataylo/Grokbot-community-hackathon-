import { sql } from "@/lib/db";
import { route, json, requireHostEvent } from "@/lib/api";
import { hasFreeShare } from "@/lib/freeshare";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { h, ev } = await requireHostEvent((await params).id);
  const [c] = await sql`select
      (select count(*)::int from guests where event_id = ${ev.id}) as guests,
      (select count(*)::int from guests where event_id = ${ev.id} and push is not null) as notify,
      (select count(*)::int from photos where event_id = ${ev.id}) as photos,
      (select count(*)::int from photos where event_id = ${ev.id} and status = 'processing') as processing,
      (select coalesce(sum(tiled_count),0)::int from photos where event_id = ${ev.id}) as tiled,
      (select count(*)::int from guests where event_id = ${ev.id} and delivered_at is not null) as delivered,
      (select count(*)::int from posts where event_id = ${ev.id}) as posts,
      (select coalesce(sum(clicks),0)::int from shares where event_id = ${ev.id}) as clicks,
      (select coalesce(sum(previews),0)::int from shares where event_id = ${ev.id}) as previews,
      (select count(*)::int from cheers c join posts p on p.id = c.post_id where p.event_id = ${ev.id}) as cheers`;
  const review = await sql`select id, render_rev from photos where event_id = ${ev.id}
    and status in ('review', 'hidden') and reviewed_at is null order by created_at limit 50`;
  const recent = await sql`select id, render_rev from photos where event_id = ${ev.id} and status = 'ready' order by created_at desc limit 12`;
  // Clicks and cheers summed separately: joining both to guests would multiply one by the other.
  const leaders = await sql`select g.name,
      (select coalesce(sum(s.clicks),0)::int from shares s where s.guest_id = g.id) as clicks,
      (select count(*)::int from cheers c join posts pp on pp.id = c.post_id where pp.guest_id = g.id) as cheers
    from guests g where g.event_id = ${ev.id}
      and (exists(select 1 from shares s where s.guest_id = g.id) or exists(select 1 from posts p where p.guest_id = g.id))
    order by clicks desc, cheers desc limit 10`;
  return json({ counts: c, review, recent, leaders, event: { delivered_at: ev.delivered_at, deliver_at: ev.deliver_at, sharing_unlocked: ev.sharing_unlocked }, free: !ev.sharing_unlocked && (await hasFreeShare(h.id)) });
});

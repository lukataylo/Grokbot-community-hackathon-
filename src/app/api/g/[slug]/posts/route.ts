import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireGuest, HttpError } from "@/lib/api";
import { notifyPost } from "@/lib/notify";
import { normalisePost } from "@/lib/posts";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  if (!ev.sharing_unlocked) throw new HttpError(402, "Sharing isn't switched on for this event");
  const b = z.object({ url: z.string().max(600), code: z.string().max(20).optional() }).parse(await req.json());
  const n = normalisePost(b.url);
  if (!n) throw new HttpError(400, "That doesn't look like a LinkedIn or X post link. In the app, tap ··· on your post, then Copy link.");
  const [share] = b.code ? await sql`select code, photo_id from shares where code = ${b.code} and guest_id = ${g.id}` : [];
  const [p] = await sql`insert into posts (event_id, guest_id, photo_id, share_code, url, platform)
    values (${ev.id}, ${g.id}, ${share?.photo_id ?? null}, ${share?.code ?? null}, ${n.url}, ${n.platform})
    on conflict (event_id, url) do nothing returning id`;
  if (!p) throw new HttpError(409, "That post is already here");
  notifyPost(p.id).catch((e) => console.error("[posts] notify", e));
  return json({ id: p.id }, 201);
});

export const GET = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  const rows = await sql`select p.id, p.url, p.platform, p.created_at, p.photo_id, ph.render_rev as v, gu.name as author, p.guest_id = ${g.id} as mine,
      exists(select 1 from photo_people pp where pp.photo_id = p.photo_id and pp.guest_id = ${g.id}) as with_me,
      exists(select 1 from cheers c where c.post_id = p.id and c.guest_id = ${g.id}) as cheered,
      (select count(*)::int from cheers c where c.post_id = p.id) as cheers,
      coalesce(s.clicks, 0) as clicks
    from posts p join guests gu on gu.id = p.guest_id left join photos ph on ph.id = p.photo_id left join shares s on s.code = p.share_code
    where p.event_id = ${ev.id} order by p.created_at desc limit 300`;
  const filter = new URL(req.url).searchParams.get("filter");
  return json(filter === "mine" ? rows.filter((r) => r.with_me) : rows);
});

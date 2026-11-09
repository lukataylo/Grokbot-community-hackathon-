import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireGuest, HttpError, isUuid } from "@/lib/api";
import { pushGuest } from "@/lib/push";
import { env } from "@/lib/env";

type Ctx = { params: Promise<{ slug: string; id: string }> };
/** Self-reported: LinkedIn and X don't tell apps who liked a post, so we ask. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const { ev, g } = await requireGuest(slug);
  if (!ev.sharing_unlocked) throw new HttpError(402, "Sharing isn't switched on for this event");
  if (!isUuid(id)) throw new HttpError(404, "Post not found");
  const { liked } = z.object({ liked: z.boolean() }).parse(await req.json());
  const [p] = await sql`select id, guest_id from posts where id = ${id} and event_id = ${ev.id}`;
  if (!p) throw new HttpError(404, "Post not found");
  if (p.guest_id === g.id) throw new HttpError(400, "That's your own post");
  if (!liked) { await sql`delete from cheers where post_id = ${id} and guest_id = ${g.id}`; return json({ ok: true }); }
  const [c] = await sql`insert into cheers (post_id, guest_id) values (${id}, ${g.id}) on conflict do nothing returning post_id`;
  if (c) {
    const [{ n }] = await sql`select count(*)::int as n from cheers where post_id = ${id}`;
    const [author] = await sql`select prefs from guests where id = ${p.guest_id}`;
    // Tell the author at 1, 5, 10, 25… likes, not every time.
    if ([1, 5, 10, 25, 50].includes(n) && (author?.prefs as { likes?: boolean })?.likes !== false)
      await pushGuest(p.guest_id, { title: ev.name, body: `${n} ${n === 1 ? "guest" : "guests"} from ${ev.name} liked your post.`, url: `${env.baseUrl}/${ev.slug}?tab=posts`, tag: `likes-${id}` });
  }
  return json({ ok: true });
});

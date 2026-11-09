import { sql } from "@/lib/db";
import { route, json, eventBySlug } from "@/lib/api";
import { currentGuest } from "@/lib/auth";
import { useStandins } from "@/lib/standins";

type Ctx = { params: Promise<{ slug: string }> };
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const ev = await eventBySlug((await params).slug);
  const g = await currentGuest(ev.id);
  const delivered = !!ev.delivered_at;
  const photos = await sql`select p.id, p.render_rev as v, p.has_standins as ai, p.guest_id = ${g?.id ?? null} as mine,
      exists(select 1 from photo_people pp where pp.photo_id = p.id and pp.guest_id = ${g?.id ?? null}) as with_me
    from photos p where p.event_id = ${ev.id} and p.status = 'ready' and not p.hold order by p.created_at desc limit 600`;
  const [{ pending }] = await sql`select count(*)::int as pending from photos where event_id = ${ev.id} and status in ('processing','review') and guest_id = ${g?.id ?? null}`;
  const [{ guests }] = await sql`select count(*)::int as guests from guests where event_id = ${ev.id}`;
  return json({
    event: { name: ev.name, hostedBy: ev.hosted_by, startsAt: ev.starts_at, endsAt: ev.ends_at, deliverAt: ev.deliver_at, delivered, sharing: ev.sharing_unlocked, uploads: ev.uploads, timezone: ev.timezone,
      faceStyle: useStandins(ev) ? "standins" : "tiles" },
    me: g ? { name: g.name, choice: g.choice, taggable: g.taggable, email: g.email, hasFace: !!g.embedding, push: !!g.push, prefs: g.prefs, resume: g.resume_code } : null,
    guests, pending,
    // Photos are live for guests as soon as faces are tiled; the morning notification is just a nudge.
    photos: g ? photos : [],
    total: g ? photos.length : 0,
  });
});

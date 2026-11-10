import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireGuest, HttpError, limit } from "@/lib/api";
import { shortCode } from "@/lib/ids";
import { env } from "@/lib/env";
import * as store from "@/lib/storage";
import { describeScene, writeCaptions, whenPhrase, type Platform } from "@/lib/agent";
import { fmt } from "@/lib/time";

type Ctx = { params: Promise<{ slug: string }> };
const Body = z.object({ photoId: z.string().uuid(), platform: z.enum(["linkedin", "x"]), note: z.string().trim().max(300).optional() });

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  if (!ev.sharing_unlocked) throw new HttpError(402, "Sharing isn't switched on for this event");
  limit("share:" + g.id, 12, 60_000);
  const b = Body.parse(await req.json());
  const [p] = await sql`select id, public_key from photos where id = ${b.photoId} and event_id = ${ev.id} and status = 'ready' and not hold`;
  if (!p) throw new HttpError(404, "Photo not found");

  // One smart link per guest, photo and platform: clicks roll up to that guest's ray.
  let [s] = await sql`select code from shares where guest_id = ${g.id} and photo_id = ${p.id} and platform = ${b.platform}`;
  if (!s) [s] = await sql`insert into shares (code, event_id, guest_id, photo_id, platform) values (${shortCode()}, ${ev.id}, ${g.id}, ${p.id}, ${b.platform}) returning code`;
  const link = `${env.baseUrl}/s/${s.code}`;

  let [c] = await sql`select scene from caption_cache where photo_id = ${p.id}`;
  if (!c && env.openrouterKey) {
    try {
      const pub = await store.get(p.public_key);
      if (pub) { const scene = await describeScene(pub); [c] = await sql`insert into caption_cache (photo_id, scene) values (${p.id}, ${scene}) on conflict (photo_id) do update set scene = excluded.scene returning scene`; }
    } catch (e) { console.warn("[share] scene skipped", (e as Error).message); }
  }
  const tags = await sql`select g.name from photo_people pp join guests g on g.id = pp.guest_id
    where pp.photo_id = ${p.id} and g.id <> ${g.id} and g.choice = 'show' and g.taggable order by g.name limit 6`;

  const out = await writeCaptions({
    platform: b.platform as Platform, guestName: g.name, note: b.note, scene: c?.scene, link,
    when: whenPhrase(new Date(ev.starts_at), new Date(), ev.timezone),
    taggable: tags.map((t) => t.name as string),
    event: { name: ev.name, hostedBy: ev.hosted_by, venue: ev.venue, date: fmt(ev.starts_at, ev.timezone, { weekday: "long", day: "numeric", month: "long" }),
      linkedin: ev.linkedin_handle, x: ev.x_handle, hashtag: ev.hashtag, template: ev.caption_template, description: ev.description, highlights: ev.highlights },
  });
  return json({ code: s.code, link, captions: out.captions, tags: tags.map((t) => t.name), ai: out.usedModel });
});

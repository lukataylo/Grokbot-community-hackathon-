import { sql } from "./db";
import { env } from "./env";
import { pushGuest } from "./push";
import { sendEmail } from "./email";

/** Delivery: every guest gets "your photos are ready" by push, else by email. */
export async function deliverEvent(eventId: string) {
  // Claim the event first, so the scheduler and "Send now" can't both deliver it.
  const [ev] = await sql`update events set delivered_at = now() where id = ${eventId} and delivered_at is null returning *`;
  if (!ev) return;
  // Photos the second check flagged and nobody approved are never published.
  await sql`update photos set status = 'hidden' where event_id = ${eventId} and status = 'review' and reviewed_at is null`;
  await notifyGuests(ev);
}

/** A crash or deploy mid-delivery: finish telling the guests who joined before delivery. */
export async function resumeDeliveries() {
  const events = await sql`select e.* from events e where e.delivered_at > now() - interval '1 day'
    and exists(select 1 from guests g where g.event_id = e.id and g.delivered_at is null and g.created_at < e.delivered_at)`;
  for (const ev of events) await notifyGuests(ev);
}

async function notifyGuests(ev: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const eventId = ev.id as string;
  const guests = await sql`
    select g.id, g.name, g.email, g.resume_code, count(pp.photo_id)::int as n
    from guests g left join photo_people pp on pp.guest_id = g.id
    where g.event_id = ${eventId} and g.delivered_at is null and g.created_at < ${ev.delivered_at} group by g.id`;
  const [{ total }] = await sql`select count(*)::int as total from photos where event_id = ${eventId} and status = 'ready'`;
  for (const g of guests) {
    const url = `${env.baseUrl}/${ev.slug}`;
    const body = g.n > 0 ? `You're in ${g.n} photo${g.n === 1 ? "" : "s"}. They're ready.` : `All ${total} photos from the night are ready.`;
    // Claim the guest before sending, so two concurrent runs never notify the same person twice.
    const [mine] = await sql`update guests set delivered_at = now() where id = ${g.id} and delivered_at is null returning id`;
    if (!mine) continue;
    try {
      const pushed = await pushGuest(g.id, { title: ev.name, body, url, tag: `deliver-${eventId}` });
      if (!pushed && g.email) {
        await sendEmail(g.email, `${ev.name}: your photos are ready`,
          `Hi ${g.name.split(" ")[0]},\n\n${body}\n\nSee them: ${env.baseUrl}/r/${g.resume_code}\n\nAnyone who asked not to be shown is covered in every photo.`);
      }
    } catch (e) { console.error("[deliver] guest", g.id, e); } // one bad address must not stop the rest
  }
}

/** Someone posted: tell the guests who are in that photo, straight away. */
export async function notifyPost(postId: string) {
  const [p] = await sql`select p.*, g.name as poster, e.slug, e.name as event_name from posts p join guests g on g.id = p.guest_id join events e on e.id = p.event_id where p.id = ${postId}`;
  if (!p?.photo_id) return;
  const people = await sql`select g.id, g.prefs from photo_people pp join guests g on g.id = pp.guest_id where pp.photo_id = ${p.photo_id} and g.id <> ${p.guest_id}`;
  for (const g of people) {
    if ((g.prefs as { post?: boolean })?.post === false) continue;
    await pushGuest(g.id, { title: `${String(p.poster).split(" ")[0]} posted a photo you're in`, body: "Give it a like? It helps the post travel.", url: `${env.baseUrl}/${p.slug}?tab=posts&post=${postId}`, tag: `post-${postId}` });
  }
}

/** Once a day at 11:00 for three days after delivery: "N new posts from <event>". */
export async function roundups() {
  const events = await sql`select * from events where sharing_unlocked and delivered_at is not null and roundups_sent < 3
    and delivered_at < now() - interval '3 hours' and (last_roundup_at is null or last_roundup_at < now() - interval '20 hours')`;
  for (const ev of events) {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: ev.timezone }).format(new Date()));
    if (hour < 11 || hour > 13) continue;
    const since = ev.last_roundup_at ?? ev.delivered_at;
    const [{ n }] = await sql`select count(*)::int as n from posts where event_id = ${ev.id} and created_at > ${since}`;
    await sql`update events set roundups_sent = roundups_sent + 1, last_roundup_at = now() where id = ${ev.id}`;
    if (!n) continue;
    const guests = await sql`select id, prefs from guests where event_id = ${ev.id}`;
    for (const g of guests) {
      if ((g.prefs as { roundup?: boolean })?.roundup === false) continue;
      await pushGuest(g.id, { title: ev.name, body: `${n} new post${n === 1 ? "" : "s"} from ${ev.name}. Cheer them on.`, url: `${env.baseUrl}/${ev.slug}?tab=posts`, tag: `roundup-${ev.id}` });
    }
  }
}

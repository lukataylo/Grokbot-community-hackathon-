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

/**
 * The round-up of new posts, timed for reach. Early likes and comments carry a post furthest, so the day's
 * round-up goes out twenty minutes after the first new post (long enough for a few more to join it), not at a
 * fixed time of day. Two things can hold it longer: it never follows the "photos are ready" message by less than
 * an hour, and a post made at night waits for 08:00. So most posts in it are past their first hour, and the
 * message doesn't claim otherwise.
 * It stays inside what guests agreed to: at most one a day, three in all, within three days of their photos
 * arriving, in the daytime. A guest hears only about posts that are still news to them: not their own, not ones
 * they have already liked, and not ones they were told about the moment they went up.
 */
const ROUNDUP_WAIT_MIN = 20;
/**
 * What the opt-in screens may still promise: how many round-ups are left, and the last moment one could go out.
 * Null once none can (sharing off, all three sent, or the three days after delivery are over). Before delivery
 * the three days haven't started, so `until` is null. Mirrors the rules in roundups() below.
 */
export function roundupsLeft(ev: { sharing_unlocked: boolean; delivered_at: Date | string | null; roundups_sent: number; last_roundup_at: Date | string | null; timezone: string }, now = Date.now()): { left: number; until: string | null } | null {
  const unsent = 3 - Number(ev.roundups_sent ?? 0);
  if (!ev.sharing_unlocked || unsent <= 0) return null;
  if (!ev.delivered_at) return { left: unsent, until: null };
  const delivered = new Date(ev.delivered_at).getTime(), end = delivered + 3 * 86_400_000;
  const from = Math.max(now, delivered + 3_600_000, ev.last_roundup_at ? new Date(ev.last_roundup_at).getTime() + 20 * 3_600_000 : 0);
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "numeric", hour12: false, timeZone: ev.timezone });
  const hm = (t: number) => { const p = fmt.formatToParts(new Date(t)); return [Number(p.find((x) => x.type === "hour")?.value) % 24, Number(p.find((x) => x.type === "minute")?.value)]; };
  const day = (h: number) => h >= 8 && h < 21;
  // The first daytime moment at or after t, and the last one at or before it. A clock change can leave the jump an hour out, so look again.
  const up = (t: number) => { for (let k = 0; k < 4; k++) { const [h, m] = hm(t); if (day(h)) break; t += ((h >= 21 ? 32 - h : 8 - h) * 60 - m) * 60_000; } return t; };
  const down = (t: number) => { for (let k = 0; k < 4; k++) { const [h, m] = hm(t); if (day(h)) break; t -= ((h >= 21 ? h - 21 : h + 3) * 60 + m + 1) * 60_000; } return t; };
  // The sender looks once a minute, so the last minute of the window can't be counted on.
  const until = down(end - 60_000);
  let n = 0;
  for (let t = up(from); t <= until && n < unsent; t = up(t + 20 * 3_600_000)) n++;
  return n ? { left: n, until: new Date(until).toISOString() } : null;
}
export async function roundups() {
  const events = await sql`select e.*, (select min(p.created_at) from posts p where p.event_id = e.id and p.created_at > coalesce(e.last_roundup_at, e.starts_at)) as first_new
    from events e where e.sharing_unlocked and e.delivered_at is not null and e.roundups_sent < 3
    and e.delivered_at < now() - interval '1 hour' and e.delivered_at > now() - interval '3 days'
    and (e.last_roundup_at is null or e.last_roundup_at < now() - interval '20 hours')`;
  for (const ev of events) {
    if (!ev.first_new || Date.now() - new Date(ev.first_new).getTime() < ROUNDUP_WAIT_MIN * 60_000) continue;
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: ev.timezone }).format(new Date())) % 24;
    if (hour < 8 || hour >= 21) continue; // a late-night post waits for the morning
    const since = ev.last_roundup_at ?? ev.starts_at; // posts from the night itself count in the first round-up
    // Claim it first, so two ticks (or two instances during a deploy) can't both send it.
    const [mine] = await sql`update events set roundups_sent = roundups_sent + 1, last_roundup_at = now() where id = ${ev.id} and roundups_sent = ${ev.roundups_sent} returning id`;
    if (!mine) continue;
    const posts = await sql`select id, guest_id, photo_id from posts where event_id = ${ev.id} and created_at > ${since}`;
    if (!posts.length) continue;
    const ids = posts.map((p) => p.id as string);
    const liked = new Set((await sql`select post_id, guest_id from cheers where post_id in ${sql(ids)}`).map((c) => `${c.post_id}:${c.guest_id}`));
    const inPhoto = new Set((await sql`select p.id, pp.guest_id from posts p join photo_people pp on pp.photo_id = p.photo_id where p.id in ${sql(ids)}`).map((c) => `${c.id}:${c.guest_id}`));
    const guests = await sql`select id, prefs from guests where event_id = ${ev.id}`;
    for (const g of guests) {
      const prefs = (g.prefs ?? {}) as { roundup?: boolean; post?: boolean };
      if (prefs.roundup === false) continue;
      const n = posts.filter((p) => p.guest_id !== g.id && !liked.has(`${p.id}:${g.id}`) && !(prefs.post !== false && inPhoto.has(`${p.id}:${g.id}`))).length;
      if (!n) continue;
      try {
        await pushGuest(g.id, { title: ev.name, body: `${n} new post${n === 1 ? "" : "s"} from ${ev.name}. A like helps ${n === 1 ? "it" : "them"} travel.`, url: `${env.baseUrl}/${ev.slug}?tab=posts`, tag: `roundup-${ev.id}` });
      } catch (e) { console.error("[roundup] guest", g.id, e); } // one bad subscription must not stop the rest
    }
  }
}

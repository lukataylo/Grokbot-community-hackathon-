import { sql, migrate } from "./db";
import { deliverEvent, resumeDeliveries, roundups } from "./notify";
import { resumePending, recheckFailedChecks, requeueStale, migrateMatching } from "./pipeline";
import * as store from "./storage";

const g = globalThis as unknown as { __lzTimer?: NodeJS.Timeout };

let ticking = false;
async function tick() {
  if (ticking) return; // a long delivery must not overlap the next tick
  ticking = true;
  try {
    const due = await sql`select id from events where delivered_at is null and deliver_at <= now()`;
    for (const e of due) await deliverEvent(e.id as string);
    await resumeDeliveries();
    await recheckFailedChecks();
    await requeueStale();
    await roundups();
    // Retention: originals and published photos leave after the host's retention window.
    const old = await sql`select p.id, p.original_key, p.public_key from photos p join events e on e.id = p.event_id
      where e.delivered_at is not null and e.delivered_at < now() - make_interval(days => e.retention_days) limit 200`;
    for (const p of old) {
      await store.del(p.original_key); if (p.public_key) await store.del(p.public_key);
      for (const c of await sql`select key from standin_cache where photo_id = ${p.id}`) await store.del(c.key as string); // stand-in overlays
      await sql`delete from photos where id = ${p.id}`;
    }
    // Face patterns go with the event, as the selfie screen promises.
    await sql`update guests g set embedding = null from events e where e.id = g.event_id and g.embedding is not null
      and e.delivered_at is not null and e.delivered_at < now() - make_interval(days => e.retention_days)`;
    await sql`delete from login_tokens where expires_at < now() - interval '1 day'`;
  } catch (e) { console.error("[scheduler]", e); }
  finally { ticking = false; }
}

export async function startScheduler() {
  if (g.__lzTimer) return;
  await migrate();
  await migrateMatching();
  await resumePending();
  g.__lzTimer = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
  console.log("[scheduler] started");
}

import { sql, migrate } from "./db";
import { deliverEvent, roundups } from "./notify";
import { resumePending } from "./pipeline";
import * as store from "./storage";

const g = globalThis as unknown as { __lzTimer?: NodeJS.Timeout };

async function tick() {
  try {
    const due = await sql`select id from events where delivered_at is null and deliver_at <= now()`;
    for (const e of due) await deliverEvent(e.id as string);
    await roundups();
    // Retention: originals and published photos leave after the host's retention window.
    const old = await sql`select p.id, p.original_key, p.public_key from photos p join events e on e.id = p.event_id
      where e.delivered_at is not null and e.delivered_at < now() - make_interval(days => e.retention_days) limit 200`;
    for (const p of old) { await store.del(p.original_key); if (p.public_key) await store.del(p.public_key); await sql`delete from photos where id = ${p.id}`; }
    await sql`delete from login_tokens where expires_at < now() - interval '1 day'`;
  } catch (e) { console.error("[scheduler]", e); }
}

export async function startScheduler() {
  if (g.__lzTimer) return;
  await migrate();
  await resumePending();
  g.__lzTimer = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
  console.log("[scheduler] started");
}

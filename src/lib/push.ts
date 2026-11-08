import * as wp from "web-push";
import type { PushSubscription } from "web-push";

const webpush = ((wp as unknown as { default?: typeof wp }).default ?? wp) as typeof wp;
import { env } from "./env";
import { sql } from "./db";

let ready = false;
function init() {
  if (ready || !env.vapidPublic || !env.vapidPrivate) return ready;
  webpush.setVapidDetails("mailto:hello@lumzel.com", env.vapidPublic, env.vapidPrivate);
  return (ready = true);
}

export type PushMsg = { title: string; body: string; url: string; tag?: string };

/** Sends to one guest. Expired subscriptions are removed so we fall back to email next time. */
export async function pushGuest(guestId: string, msg: PushMsg): Promise<boolean> {
  if (!init()) return false;
  const [g] = await sql`select push from guests where id = ${guestId}`;
  if (!g?.push) return false;
  try {
    await webpush.sendNotification(g.push as PushSubscription, JSON.stringify(msg), { TTL: 60 * 60 * 12, urgency: "normal" });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await sql`update guests set push = null where id = ${guestId}`;
    console.warn("[push] failed", code);
    return false;
  }
}

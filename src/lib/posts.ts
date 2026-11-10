import type { Sql } from "postgres";
/** Accepts LinkedIn and X post links only, normalised so the same post can't be added twice. */
export function normalisePost(raw: string): { url: string; platform: "linkedin" | "x" } | null {
  const m = raw.match(/https?:\/\/[^\s]+/);
  let u: URL;
  try { u = new URL(m ? m[0] : raw.startsWith("http") ? raw : "https://" + raw); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "linkedin.com" || host.endsWith(".linkedin.com") || host === "lnkd.in") {
    if (!/\/(posts|feed\/update|pulse)\//.test(u.pathname) && host !== "lnkd.in") return null;
    const path = u.pathname.replace(/\/$/, "");
    return { url: host === "lnkd.in" ? `https://lnkd.in${path}` : `https://www.linkedin.com${path}`, platform: "linkedin" };
  }
  if (["x.com", "twitter.com"].includes(host)) {
    const s = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    return s ? { url: `https://x.com/${s[1]}/status/${s[2]}`, platform: "x" } : null;
  }
  return null;
}


/**
 * A guest left, or asked to be covered or not tagged: their name comes out of what we keep of other guests' posts.
 * Any stored preview that names them in full is dropped (the post itself, on LinkedIn or X, is the poster's own),
 * along with comment ideas written from it and the unused first drafts. A first name on its own can't be told apart
 * from anyone else's, so it is not matched.
 */
export async function forgetName(tx: Sql, eventId: string, guestId: string, name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 3) return;
  const has = new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "iu");
  const rows = await tx`select id, caption from posts where event_id = ${eventId} and guest_id <> ${guestId} and caption is not null`;
  const ids = rows.filter((r) => has.test(String(r.caption))).map((r) => r.id as string);
  if (ids.length) {
    await tx`update posts set caption = null where id in ${tx(ids)}`;
    await tx`delete from comment_ideas where post_id in ${tx(ids)}`;
  }
  const drafts = await tx`select code, caption from shares where event_id = ${eventId} and guest_id <> ${guestId} and caption <> ''`;
  const codes = drafts.filter((r) => has.test(String(r.caption))).map((r) => r.code as string);
  if (codes.length) await tx`update shares set caption = '' where code in ${tx(codes)}`;
}

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { identifyPeople, polishCopy, grokMode, grokWriteKit, regenerateKitItem, writeAnnouncement, writeDigest } from "./grok";
import { applyTags, buildPlan, logActivity, savePlan } from "./engine";
import { approveAll, getKit, kitMarkdown, markPublished, mockAnnouncement, mockKit, saveKit, timeLabel, updateItem, type KitInput } from "./kit";
import { icsUrl, mockDigest, parseIcs, sampleIcs, thisWeek } from "./digest";
import { mutate, readDB } from "./store";
import type { Brand, KitFacts, KitKey, Photo } from "./types";

function imageDataUrl(photo: Photo): string | undefined {
  if (!photo.url.startsWith("/uploads/")) return undefined;
  const file = path.join(process.cwd(), "data", photo.url);
  if (!fs.existsSync(file)) return undefined;
  const ext = path.extname(file).slice(1).replace("jpg", "jpeg").replace("svg", "svg+xml");
  return `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`;
}

export async function tagPhotos(eventId: string, photoIds?: string[]) {
  const db = readDB();
  const roster = db.attendees.filter((a) => a.eventId === eventId);
  const targets = db.photos.filter((p) => p.eventId === eventId && (photoIds ? photoIds.includes(p.id) : p.status === "pending"));
  const results = await Promise.all(targets.map(async (p) => ({ id: p.id, r: await identifyPeople(p, roster, imageDataUrl(p)) })));
  return mutate((db) => {
    for (const { id, r } of results) applyTags(db, eventId, id, r);
    return results.length;
  });
}

export async function generatePlan(eventId: string) {
  const db = readDB();
  const at = (id: string) => db.attendees.find((a) => a.id === id)!;
  const plan = buildPlan(db, eventId);
  const polished = await polishCopy(plan.tasks.map((x) => ({ id: x.id, who: at(x.attendeeId).name, type: x.type, platform: x.platform, draft: x.copy })));
  for (const x of plan.tasks) if (polished[x.id]) x.copy = polished[x.id];
  return mutate((db) => savePlan(db, eventId, plan, grokMode()));
}

// ---------- Event Autopilot ----------

type LumaFacts = Partial<KitFacts> & { description?: string };

/** ProseMirror JSON (Luma's description_mirror) to plain text. */
function mirrorText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[]; type?: string };
  const inner = (n.content ?? []).map(mirrorText).join(n.type === "doc" ? "\n" : "");
  return (n.text ?? "") + inner;
}

export function lumaId(input: string) {
  const s = input.trim();
  return s.match(/evt-[A-Za-z0-9]+/)?.[0] ?? s.replace(/^https?:\/\/(www\.)?(lu\.ma|luma\.com)\//, "").split(/[/?#]/)[0];
}

/** Public Luma event JSON (no key). Accepts an evt- id or a lu.ma/<slug> URL. */
export async function fetchLuma(input: string): Promise<LumaFacts | null> {
  const id = lumaId(input);
  if (!id) return null;
  const url = id.startsWith("evt-") ? `https://api.lu.ma/event/get?event_api_id=${id}` : `https://api.lu.ma/url?url=${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const raw = await res.json();
    const j = raw.data ?? raw;
    const e = j.event ?? {};
    const geo = e.geo_address_info ?? {};
    const desc = (typeof j.description === "string" && j.description) || mirrorText(j.description_mirror);
    const facts: LumaFacts = {
      name: e.name,
      startsAt: e.start_at,
      endsAt: e.end_at,
      venue: geo.address ?? geo.full_address ?? geo.city_state ?? undefined,
      url: e.url ? `https://lu.ma/${e.url}` : undefined,
      hosts: Array.isArray(j.hosts) ? j.hosts.map((h: { name?: string }) => h.name).filter(Boolean) : [],
      headcount: typeof j.guest_count === "number" && j.guest_count > 0 ? j.guest_count : undefined,
      description: desc ? desc.replace(/\s+/g, " ").trim().slice(0, 1200) : undefined,
    };
    return facts.name ? facts : null;
  } catch (e) {
    console.error("Luma fetch failed", e);
    return null;
  }
}

export async function generateKit(input: Omit<KitInput, "luma"> & { luma?: string; brand?: Brand }) {
  const luma = input.luma?.trim() ? { id: lumaId(input.luma), facts: await fetchLuma(input.luma) } : undefined;
  const kit = await grokWriteKit(mockKit({ ...input, luma }));
  mutate((db) => saveKit(db, kit));
  return kit;
}

export async function regenerateItem(eventId: string, key: KitKey) {
  const kit = getKit(readDB(), eventId);
  if (!kit) return false;
  const data = await regenerateKitItem(kit, key);
  return mutate((db) => updateItem(db, eventId, key, { regenerated: data }));
}

/** Ghost Admin API token: HS256 JWT signed with the hex secret from an "id:secret" Admin key. */
function ghostToken(key: string) {
  const [id, secret] = key.split(":");
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: "HS256", typ: "JWT", kid: id })}.${b64({ iat, exp: iat + 300, aud: "/admin/" })}`;
  return `${head}.${crypto.createHmac("sha256", Buffer.from(secret, "hex")).update(head).digest("base64url")}`;
}

async function sendGhost(title: string, html: string, excerpt: string) {
  const url = process.env.GHOST_ADMIN_URL;
  const key = process.env.GHOST_ADMIN_KEY;
  if (!url || !key) return undefined;
  const res = await fetch(`${url.replace(/\/$/, "")}/ghost/api/admin/posts/?source=html`, {
    method: "POST",
    headers: { Authorization: `Ghost ${ghostToken(key)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ posts: [{ title, html, status: "draft", custom_excerpt: excerpt.slice(0, 300) }] }),
  });
  if (!res.ok) throw new Error(`Ghost ${res.status}: ${await res.text()}`);
  const post = (await res.json()).posts?.[0];
  return `Ghost draft created${post?.url ? ` (${post.url})` : ""}`;
}

async function sendDiscord(content: string) {
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return undefined;
  const res = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: content.slice(0, 2000) }) });
  if (!res.ok) throw new Error(`Discord ${res.status}`);
  return "posted to Discord webhook";
}

export const integrations = () => ({
  ghost: !!(process.env.GHOST_ADMIN_URL && process.env.GHOST_ADMIN_KEY),
  discord: !!process.env.DISCORD_WEBHOOK_URL,
  notion: !!(process.env.NOTION_TOKEN && process.env.NOTION_PARENT_PAGE_ID),
});

/** Optionally approve everything, then deliver each approved piece through a real integration where one is configured. */
export async function publishKit(eventId: string, all: boolean) {
  if (all) mutate((db) => approveAll(db, eventId));
  const kit = getKit(readDB(), eventId);
  if (!kit) return { count: 0, errors: [] as string[] };
  const via: Partial<Record<KitKey, string>> = {};
  const errors: string[] = [];
  const run = async (key: KitKey, fn: () => Promise<string | undefined>) => {
    if (kit.items[key].status !== "approved") return;
    try {
      const r = await fn();
      if (r) via[key] = r;
    } catch (e) {
      errors.push(String(e));
    }
  };
  await run("newsletter", () => sendGhost(kit.items.newsletter.data.subject, kit.items.newsletter.data.html, kit.items.newsletter.data.preheader));
  await run("post:discord", () => sendDiscord(kit.items["post:discord"].data.text));
  const count = mutate((db) => markPublished(db, eventId, via));
  return { count, errors };
}

/** Create a Notion page with the run sheet, budget and rota as tables. */
export async function exportNotion(eventId: string) {
  const kit = getKit(readDB(), eventId);
  if (!kit) return { ok: false, error: "No kit yet" };
  const token = process.env.NOTION_TOKEN;
  const parent = process.env.NOTION_PARENT_PAGE_ID;
  if (!token || !parent) return { ok: false, markdown: kitMarkdown(kit) };
  const rt = (content: string) => [{ type: "text", text: { content: content.slice(0, 1900) } }];
  const table = (header: string[], rows: string[][]) => ({
    object: "block",
    type: "table",
    table: { table_width: header.length, has_column_header: true, has_row_header: false, children: [header, ...rows].map((r) => ({ object: "block", type: "table_row", table_row: { cells: r.map(rt) } })) },
  });
  const h2 = (t: string) => ({ object: "block", type: "heading_2", heading_2: { rich_text: rt(t) } });
  const d = kit.items;
  const total = d.budget.data.reduce((s, b) => s + b.cost, 0);
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify({
      parent: { page_id: parent },
      properties: { title: { title: rt(`${d.page.data.title} · event workspace`) } },
      children: [
        { object: "block", type: "paragraph", paragraph: { rich_text: rt(`${kit.facts.venue} · ${new Date(kit.facts.startsAt).toUTCString()} · generated by Grokbot Event Autopilot`) } },
        h2("Run sheet"),
        table(["Time", "Item", "Owner", "Notes"], d.runSheet.data.map((r) => [timeLabel(r.time), r.item, r.owner, r.notes])),
        h2(`Budget (£${total.toFixed(2)})`),
        table(["Item", "Supplier", "Cost", "Source"], d.budget.data.map((b) => [b.item, b.supplier, `£${b.cost.toFixed(2)}`, b.source])),
        h2("Volunteer rota"),
        table(["Role", "From", "To", "Person"], d.rota.data.map((r) => [r.role, timeLabel(r.start), timeLabel(r.end), r.person ?? "needs a volunteer"])),
      ],
    }),
  });
  if (!res.ok) return { ok: false, error: `Notion ${res.status}: ${(await res.text()).slice(0, 200)}`, markdown: kitMarkdown(kit) };
  const page = await res.json();
  mutate((db) => logActivity(db, { eventId, kind: "kit", text: "Autopilot exported the run sheet, budget and rota to Notion" }));
  return { ok: true, url: page.url as string };
}

/** Night-of helper: Grok writes the update, then it goes to Discord if a webhook is set. */
export async function announce(eventId: string, change: string) {
  const db = readDB();
  const name = getKit(db, eventId)?.facts.name ?? db.events.find((e) => e.id === eventId)?.name ?? "tonight";
  const text = await writeAnnouncement(change, name, mockAnnouncement(change, name));
  let via = "WhatsApp share link";
  try {
    via = (await sendDiscord(text)) ?? via;
  } catch (e) {
    console.error(e);
  }
  mutate((d) => logActivity(d, { eventId, kind: "announce", text: `Pushed update (${via}): ${text.slice(0, 120)}` }));
  return { text, via };
}

export async function buildDigest(calendar: string, community: string) {
  let feed: "luma" | "sample" = "sample";
  let ics = "";
  try {
    const res = await fetch(icsUrl(calendar), { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      ics = await res.text();
      if (ics.includes("BEGIN:VCALENDAR")) feed = "luma";
    }
  } catch (e) {
    console.error("Luma ics fetch failed, using sample feed", e);
  }
  const events = thisWeek(parseIcs(feed === "luma" ? ics : sampleIcs()));
  const digest = mockDigest(calendar, feed, events, community, await writeDigest(events, community));
  mutate((db) => {
    db.digest = digest;
  });
  return digest;
}

import type { BudgetLine, Brand, DB, EventKit, KitData, KitFacts, KitItems, KitKey, RotaSlot } from "./types";
import { logActivity } from "./engine";

/**
 * Event Autopilot: pure, isomorphic logic that turns a one-line idea (plus an optional
 * notes/receipts dump and Luma facts) into a full event kit. The deterministic writer
 * here is the mock and the fallback; Grok output is merged over it in grok.ts.
 */

export const KIT_KEYS: KitKey[] = [
  "page", "runSheet", "budget", "rota",
  "post:linkedin", "post:x", "post:whatsapp", "post:discord",
  "newsletter",
  "visual:square", "visual:story", "visual:banner", "visual:newsletter-header",
];

export const KIT_LABEL: Record<KitKey, string> = {
  page: "Event page",
  runSheet: "Run sheet",
  budget: "Budget",
  rota: "Volunteer rota",
  "post:linkedin": "LinkedIn post",
  "post:x": "X post",
  "post:whatsapp": "WhatsApp group message",
  "post:discord": "Discord announcement",
  newsletter: "Newsletter (Ghost)",
  "visual:square": "Visual · square 1080×1080",
  "visual:story": "Visual · story 1080×1920",
  "visual:banner": "Visual · banner 1600×900",
  "visual:newsletter-header": "Visual · newsletter header 1200×400",
};

export const DEFAULT_BRAND: Brand = { community: "Grok Bot London", primary: "#45b8fb", accent: "#8fb8ff", background: "#0c1f4d", font: "sans" };

export interface KitInput {
  eventId: string;
  idea: string;
  dump?: string;
  brand?: Brand;
  luma?: { id: string; facts: Partial<KitFacts> & { description?: string } | null };
  /** Known facts that win over anything parsed from the idea (used by the seed). */
  facts?: Partial<KitFacts>;
}

// ---------- parsing the idea and the dump ----------

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const FOOD = ["pizza", "pastries", "breakfast", "drinks", "beer", "tacos", "curry", "snacks", "coffee", "sushi", "burgers", "dumplings", "wine"];

const titleCase = (s: string) =>
  s.split(/\s+/).filter(Boolean).map((w) => (/^[A-Z0-9]{2,}$/.test(w) || /^(ai|ml|llm|ux|ui|vc)$/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");

export function londonOffsetMs(d: Date) {
  const wall = new Date(d.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return wall.getTime() - utc.getTime();
}

function parseWhen(idea: string, now: Date) {
  const lower = idea.toLowerCase();
  const d = new Date(now);
  const day = WEEKDAYS.findIndex((w) => lower.includes(w));
  if (lower.includes("tomorrow")) d.setUTCDate(d.getUTCDate() + 1);
  else if (!/tonight|today/.test(lower)) {
    const target = day >= 0 ? day : 4;
    const add = (target - d.getUTCDay() + 7) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + add);
  }
  const breakfast = /breakfast|morning|coffee/.test(lower);
  const t = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let h = breakfast ? 8 : 18;
  let m = 30;
  if (t) {
    h = (Number(t[1]) % 12) + (t[3] === "pm" ? 12 : 0);
    m = Number(t[2] ?? 0);
  }
  // Times in the idea are London wall-clock times; convert with that day's offset (BST or GMT).
  d.setUTCHours(h, m, 0, 0);
  d.setTime(d.getTime() - londonOffsetMs(d));
  const hours = breakfast ? 2 : /hack/.test(lower) ? 5 : 3;
  return { startsAt: d.toISOString(), endsAt: new Date(d.getTime() + hours * 3600000).toISOString() };
}

function nameFromIdea(idea: string) {
  const core = idea
    .replace(/\b(next|this|on)\s+(mon|tues|wednes|thurs|fri|satur|sun)day\b/gi, "")
    .replace(/\b(tonight|tomorrow|today)\b/gi, "")
    .split(/\s(?:for|at|with|in|on|near|from)\s|[,.;:!]/i)[0]
    .replace(/^(a|an|the)\s+/i, "")
    .trim();
  return titleCase(core.split(/\s+/).slice(0, 6).join(" ") || "Community Meetup");
}

const hashtagFrom = (name: string) =>
  "#" +
  name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter((w) => w && !/^(the|and|of|for|a|an|with|at)$/i.test(w)).slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join("") +
  "LDN";

export function parseDump(dump: string) {
  const budget: BudgetLine[] = [];
  const volunteers: string[] = [];
  const hosts: string[] = [];
  const notes: string[] = [];
  for (const raw of dump.split(/\n+/)) {
    const line = raw.trim().replace(/^[-*•]\s*/, "");
    if (!line) continue;
    const vol = line.match(/^volunteers?\s*[:\-–]\s*(.+)/i);
    const host = line.match(/^(?:speakers?|hosts?|mc)\s*[:\-–]\s*(.+)/i);
    const money = line.match(/£\s?(\d+(?:[.,]\d{1,2})?)(k?)/i);
    const names = (s: string) => s.split(/,|\band\b|&/).map((x) => x.trim()).filter(Boolean);
    if (vol) volunteers.push(...names(vol[1]));
    else if (host) hosts.push(...names(host[1]));
    else if (money) {
      const cost = Number(money[1].replace(",", ".")) * (money[2] ? 1000 : 1);
      const supplier = line.match(/(?:from|via|by|@)\s+([A-Z][\w'&.]*(?:\s+[A-Z][\w'&.]*)*)/)?.[1] ?? "—";
      const item = line.replace(money[0], "").replace(/(?:from|via|by|@)\s+[A-Z][\w'&.]*(?:\s+[A-Z][\w'&.]*)*/, "").replace(/\b(quote[ds]?|receipt|paid|invoice)\b/gi, "").replace(/[:\-–()]+/g, " ").replace(/\s+/g, " ").trim();
      budget.push({ item: item ? item[0].toUpperCase() + item.slice(1) : "Misc", supplier, cost, source: /quote/i.test(line) ? "quote" : /estimate|approx|~/i.test(line) ? "estimate" : "receipt" });
    } else notes.push(line);
  }
  return { budget, volunteers, hosts, notes };
}

export function factsFromIdea(input: KitInput, now = new Date()): KitFacts {
  const idea = input.idea.trim();
  const dump = parseDump(input.dump ?? "");
  const luma = { ...input.luma?.facts, ...input.facts };
  const name = luma.name || nameFromIdea(idea);
  const when = parseWhen(idea, now);
  const venue = luma.venue || idea.match(/\bat\s+([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*)*)/)?.[1] || "Venue TBC, London";
  return {
    name,
    startsAt: luma.startsAt || when.startsAt,
    endsAt: luma.endsAt || when.endsAt,
    venue,
    hosts: luma.hosts?.length ? luma.hosts : dump.hosts,
    headcount: Number(idea.match(/(\d{2,4})\s*(?:people|guests|attendees|builders|devs|founders|folks|of us)/i)?.[1] ?? luma.headcount ?? 60),
    url: luma.url,
    hashtag: luma.hashtag || hashtagFrom(name),
  };
}

// ---------- the deterministic writer ----------

const at = (iso: string, mins: number) => new Date(new Date(iso).getTime() + mins * 60000).toISOString();
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const pick = <T,>(xs: T[], v: number) => xs[v % xs.length];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function agendaFor(idea: string): string[] {
  const l = idea.toLowerCase();
  if (/hack/.test(l)) return ["Doors, food and team forming", "Kickoff and track briefs", "Hacking", "Code freeze and demos", "Judging and prizes"];
  if (/breakfast|coffee|morning/.test(l)) return ["Coffee and intros", "Three lightning talks", "Open Q&A", "Small-group tables"];
  if (/panel/.test(l)) return ["Doors and drinks", "Panel discussion", "Audience Q&A", "Networking"];
  if (/workshop|hands-on|build/.test(l)) return ["Doors and setup", "Guided workshop", "Build time with mentors", "Show and tell"];
  return ["Doors and drinks", "Two short talks", "Q&A", "Networking"];
}

function foodFor(idea: string, dump: string) {
  return FOOD.find((f) => (idea + " " + dump).toLowerCase().includes(f)) ?? "pizza";
}

export function mockItem<K extends KitKey>(kit: Pick<EventKit, "idea" | "dump" | "facts" | "brand" | "lumaDescription"> & { items: Partial<KitItems> }, key: K, variant = 0): KitData[K] {
  const f = kit.facts;
  // The page is the root every other piece reads from, so only build it here when it is not the item being built.
  const page = (kit.items.page?.data ?? (key === "page" ? undefined : mockItem(kit, "page", 0))) as KitData["page"];
  const rota = (kit.items.rota?.data ?? []) as RotaSlot[];
  const dump = parseDump(kit.dump);
  const food = foodFor(kit.idea, kit.dump);
  const when = `${dayLabel(f.startsAt)}, ${timeLabel(f.startsAt)}–${timeLabel(f.endsAt)}`;
  const link = f.url ?? "link in bio";
  const hostLine = f.hosts.length ? ` Hosted by ${f.hosts.join(", ")}.` : "";
  const owner = (role: string) => rota.find((r) => r.role === role)?.person ?? role;
  const out: { [P in KitKey]: () => KitData[P] } = {
    page: () => {
      const agenda = agendaFor(kit.idea);
      const taglines = [
        `${f.headcount} people, one room, zero fluff.`,
        `The ${kit.brand.community} crowd, in person, with ${food}.`,
        `Bring a laptop, a question and a friend.`,
      ];
      return {
        title: f.name,
        tagline: pick(taglines, variant),
        description:
          kit.lumaDescription ||
          `${f.name} is a ${/hack/i.test(kit.idea) ? "hands-on build night" : /breakfast|morning|coffee/i.test(kit.idea) ? "relaxed morning" : "relaxed evening"} for ${f.headcount} people from the ${kit.brand.community} community at ${f.venue}.${hostLine} ${food[0].toUpperCase() + food.slice(1)} on us. Come for the ${agenda[1].toLowerCase()}, stay for the people.${dump.notes.length ? " " + dump.notes.slice(0, 2).join(" ") : ""}`,
        agenda,
      };
    },
    rota: () => {
      const roles: [string, number, number][] = [
        ["Setup lead", -120, 15],
        ["Door & check-in", -15, 75],
        ["Host / MC", -20, 0],
        ["AV & stream", -75, 0],
        ["Food & drinks", -45, 60],
        ["Photos", 0, 0],
        ["Pack-down", -30, 30],
      ];
      const start = f.startsAt;
      const end = f.endsAt;
      return roles.map(([role, s, e], i) => ({
        role,
        start: role === "Pack-down" ? at(end, s) : at(start, s),
        end: role === "Pack-down" ? at(end, e) : e ? at(start, e) : end,
        person: dump.volunteers.length ? dump.volunteers[(i + variant) % dump.volunteers.length] : role === "Host / MC" && f.hosts[0] ? f.hosts[0] : undefined,
      }));
    },
    runSheet: () => {
      const s = f.startsAt;
      const e = f.endsAt;
      const span = (new Date(e).getTime() - new Date(s).getTime()) / 60000;
      const middle = page.agenda.slice(1, -1);
      const slot = Math.max(15, Math.floor((span - 60) / Math.max(1, middle.length)));
      const foodSupplier = [...dump.budget].find((b) => /food|pizza|catering|pastr|drinks/i.test(b.item + b.supplier))?.supplier;
      return [
        { time: at(s, -120), item: "Venue access and room setup", owner: owner("Setup lead"), notes: `Chairs for ${f.headcount}, signage at the door, wifi details on screen` },
        { time: at(s, -75), item: "AV, mics and slides check", owner: owner("AV & stream"), notes: "Test every speaker's laptop and the clicker" },
        { time: at(s, -45), item: `${food[0].toUpperCase() + food.slice(1)} delivery`, owner: owner("Food & drinks"), notes: foodSupplier && foodSupplier !== "—" ? `From ${foodSupplier}. Check dietary labels` : "Check dietary labels" },
        { time: at(s, -20), item: "Volunteer briefing", owner: owner("Host / MC"), notes: "Roles, fire exits, safeguarding contact, photo-consent lanyards" },
        { time: s, item: "Doors open, QR check-in", owner: owner("Door & check-in"), notes: "Scan QR, consent choices set at the door" },
        { time: at(s, 20), item: "Welcome and housekeeping", owner: owner("Host / MC"), notes: "Code of conduct, sponsors, hashtag " + f.hashtag },
        ...middle.map((m, i) => ({ time: at(s, 30 + i * slot), item: m, owner: i === 0 && f.hosts[0] ? f.hosts[0] : owner("Host / MC"), notes: i === 0 ? "Keep to time, 2-minute warning card" : "" })),
        { time: at(e, -15), item: "Group photo and thank-yous", owner: owner("Photos"), notes: "Only people with photo consent in the front" },
        { time: e, item: "Doors close, pack-down", owner: owner("Pack-down"), notes: "Recycling out, venue walkround, lost property" },
      ];
    },
    budget: () => {
      if (dump.budget.length) return dump.budget;
      const n = f.headcount;
      return [
        { item: food[0].toUpperCase() + food.slice(1), supplier: "—", cost: Math.round(n * (food === "pizza" ? 7.5 : 6)), source: "estimate" as const },
        { item: "Soft drinks and water", supplier: "—", cost: Math.round(n * 2), source: "estimate" as const },
        { item: "Venue", supplier: f.venue, cost: 0, source: "estimate" as const },
        { item: "Name badges and lanyards", supplier: "—", cost: Math.round(n * 0.6), source: "estimate" as const },
      ];
    },
    "post:linkedin": () =>
      ({
        text: pick(
          [
            `We're running ${f.name} on ${dayLabel(f.startsAt)} at ${f.venue}.\n\n${page.tagline} Here's the plan:\n${page.agenda.map((a) => `→ ${a}`).join("\n")}\n\n${f.headcount} spots, ${food} included.${hostLine}\n\nRSVP: ${link}\n\n${f.hashtag}`,
            `Community leads, builders, the curious: ${f.name} is on.\n\n📍 ${f.venue}\n🗓 ${when}\n\n${page.description.split(". ").slice(0, 2).join(". ")}.\n\nSpaces go fast. RSVP: ${link} ${f.hashtag}`,
          ],
          variant,
        ),
      }),
    "post:x": () =>
      ({
        text: pick(
          [
            `${f.name} 🗓 ${dayLabel(f.startsAt).split(",")[0]} ${timeLabel(f.startsAt)} 📍 ${f.venue}\n${page.tagline}\nRSVP → ${link} ${f.hashtag}`,
            `London: ${f.headcount} of us, ${food}, and ${page.agenda[1].toLowerCase()}. ${f.name} at ${f.venue}. ${link} ${f.hashtag}`,
          ],
          variant,
        ).slice(0, 280),
      }),
    "post:whatsapp": () =>
      ({
        text: pick(
          [
            `Hey all 👋 *${f.name}* is happening!\n\n🗓 ${when}\n📍 ${f.venue}\n🍕 ${food[0].toUpperCase() + food.slice(1)} included\n\n${page.tagline}\nRSVP here 👉 ${link}\n\nReply 🙋 if you can help on the night!`,
            `📣 ${f.name}, ${dayLabel(f.startsAt)}\n${page.agenda.map((a) => `• ${a}`).join("\n")}\nOnly ${f.headcount} spots, grab one: ${link}`,
          ],
          variant,
        ),
      }),
    "post:discord": () =>
      ({
        text: pick(
          [
            `## 📣 ${f.name}\n**When:** ${when}\n**Where:** ${f.venue}\n\n${page.description}\n\n**Agenda**\n${page.agenda.map((a) => `- ${a}`).join("\n")}\n\n👉 RSVP: ${link}\nReact with 🙋 to volunteer.`,
            `@everyone **${f.name}** is live for RSVPs!\n> ${page.tagline}\n🗓 ${when} · 📍 ${f.venue}\n${link}`,
          ],
          variant,
        ),
      }),
    newsletter: () => {
      const subject = pick([`${f.name}: ${dayLabel(f.startsAt).split(",")[0]} at ${f.venue}`, `You're invited: ${f.name}`, `${f.headcount} spots: ${f.name}`], variant);
      const preheader = page.tagline;
      const c = kit.brand;
      const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
<p style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${c.primary};margin:0 0 8px">${esc(c.community)} · Newsletter</p>
<h1 style="font-size:28px;margin:0 0 6px">${esc(page.title)}</h1>
<p style="font-size:16px;color:#555;margin:0 0 16px">${esc(page.tagline)}</p>
<p style="font-size:15px;margin:0 0 4px"><strong>🗓 ${esc(when)}</strong></p>
<p style="font-size:15px;margin:0 0 16px"><strong>📍 ${esc(f.venue)}</strong></p>
<p style="font-size:15px;line-height:1.6">${esc(page.description)}</p>
<h3 style="font-size:16px;margin:20px 0 6px">What's on</h3>
<ul style="font-size:15px;line-height:1.7;padding-left:18px">${page.agenda.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
<p style="margin:24px 0"><a href="${esc(f.url ?? "#")}" style="background:${c.primary};color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">RSVP now</a></p>
<p style="font-size:13px;color:#777">Want to help on the night? Just reply to this email. We need people on the door, food and photos.</p>
</div>`;
      return { subject, preheader, html };
    },
    "visual:square": () => ({ headline: page.title }),
    "visual:story": () => ({ headline: page.title }),
    "visual:banner": () => ({ headline: page.title }),
    "visual:newsletter-header": () => ({ headline: page.title }),
  };
  return out[key]() as KitData[K];
}

/** Build a complete kit with the deterministic writer. Order matters: later items read earlier ones. */
export function mockKit(input: KitInput, now = new Date()): EventKit {
  const facts = factsFromIdea(input, now);
  const kit: EventKit = {
    eventId: input.eventId,
    idea: input.idea.trim(),
    dump: input.dump ?? "",
    generatedAt: now.toISOString(),
    source: "mock",
    luma: input.luma ? { id: input.luma.id, ok: !!input.luma.facts } : undefined,
    facts,
    brand: input.brand ?? DEFAULT_BRAND,
    items: {} as KitItems,
    lumaDescription: input.luma?.facts?.description,
  };
  for (const k of ["page", "rota", "runSheet", "budget", ...KIT_KEYS.filter((x) => !["page", "rota", "runSheet", "budget"].includes(x))] as KitKey[]) {
    (kit.items as Record<KitKey, unknown>)[k] = { status: "draft", data: mockItem(kit, k, 0), variant: 0 };
  }
  return kit;
}

// ---------- approve, edit, publish ----------

export function getKit(db: DB, eventId: string) {
  return db.kits?.[eventId];
}

export function saveKit(db: DB, kit: EventKit) {
  db.kits ??= {};
  db.kits[kit.eventId] = kit;
  logActivity(db, { eventId: kit.eventId, kind: "kit", text: `Autopilot drafted ${KIT_KEYS.length} pieces for "${kit.facts.name}" (${kit.source === "grok" ? "Grok" : "templates"})` });
}

export function updateItem(db: DB, eventId: string, key: KitKey, patch: { status?: "draft" | "approved"; data?: unknown; regenerated?: unknown }) {
  const kit = getKit(db, eventId);
  if (!kit) return false;
  const item = kit.items[key] as { status: string; data: unknown; variant: number; edited?: boolean };
  if (patch.data !== undefined) {
    item.data = patch.data;
    item.edited = true;
    item.status = "draft";
  }
  if (patch.regenerated !== undefined) {
    item.data = patch.regenerated;
    item.variant += 1;
    item.edited = false;
    item.status = "draft";
  }
  if (patch.status) {
    item.status = patch.status;
    if (patch.status === "approved") logActivity(db, { eventId, kind: "kit", text: `Lead approved the ${KIT_LABEL[key]}` });
  }
  return true;
}

export function setBrand(db: DB, eventId: string, brand: Brand) {
  const kit = getKit(db, eventId);
  if (!kit) return false;
  kit.brand = brand;
  // The newsletter HTML is a brand template (only subject and preheader are editable), so re-render it.
  kit.items.newsletter.data.html = mockItem(kit, "newsletter", kit.items.newsletter.variant).html;
  return true;
}

export function approveAll(db: DB, eventId: string) {
  const kit = getKit(db, eventId);
  let n = 0;
  if (kit)
    for (const k of KIT_KEYS) {
      if (kit.items[k].status === "draft") {
        kit.items[k].status = "approved";
        n++;
      }
    }
  const plan = db.plans[eventId];
  if (plan && !plan.approved) {
    plan.approved = true;
    plan.approvedAt = new Date().toISOString();
    n++;
  }
  return n;
}

export function approvePlan(db: DB, eventId: string) {
  const plan = db.plans[eventId];
  if (!plan) return false;
  plan.approved = true;
  plan.approvedAt = new Date().toISOString();
  logActivity(db, { eventId, kind: "plan", text: "Lead approved the sharing plan. Attendees can see their tasks." });
  return true;
}

/** Default delivery when no integration is configured for a piece. */
export const DEFAULT_VIA: Record<KitKey, string> = {
  page: "copied to event page",
  runSheet: "shared with volunteers",
  budget: "saved",
  rota: "shared with volunteers",
  "post:linkedin": "LinkedIn share link",
  "post:x": "X share link",
  "post:whatsapp": "WhatsApp share link",
  "post:discord": "copied for Discord",
  newsletter: "HTML export",
  "visual:square": "PNG export",
  "visual:story": "PNG export",
  "visual:banner": "PNG export",
  "visual:newsletter-header": "PNG export",
};

/** Mark every approved piece as sent. `via` holds the results from real integrations (Ghost, Discord). */
export function markPublished(db: DB, eventId: string, via: Partial<Record<KitKey, string>> = {}) {
  const kit = getKit(db, eventId);
  if (!kit) return 0;
  const now = new Date().toISOString();
  let n = 0;
  for (const k of KIT_KEYS) {
    const item = kit.items[k];
    if (item.status !== "approved") continue;
    item.status = "sent";
    item.sentAt = now;
    item.sentVia = via[k] ?? DEFAULT_VIA[k];
    n++;
  }
  kit.publishedAt = now;
  const live = Object.entries(via).map(([k, v]) => `${KIT_LABEL[k as KitKey]} → ${v}`);
  logActivity(db, { eventId, kind: "kit", text: `Autopilot published ${n} pieces for "${kit.facts.name}"${live.length ? ` (${live.join("; ")})` : ""}` });
  return n;
}

export function kitMarkdown(kit: EventKit) {
  const d = kit.items;
  const t = (iso: string) => timeLabel(iso);
  const total = d.budget.data.reduce((s, b) => s + b.cost, 0);
  return [
    `# ${d.page.data.title}`,
    `${dayLabel(kit.facts.startsAt)} · ${kit.facts.venue}`,
    "",
    "## Run sheet",
    "| Time | Item | Owner | Notes |",
    "| --- | --- | --- | --- |",
    ...d.runSheet.data.map((r) => `| ${t(r.time)} | ${r.item} | ${r.owner} | ${r.notes} |`),
    "",
    "## Budget",
    "| Item | Supplier | Cost | Source |",
    "| --- | --- | --- | --- |",
    ...d.budget.data.map((b) => `| ${b.item} | ${b.supplier} | £${b.cost.toFixed(2)} | ${b.source} |`),
    `| **Total** | | **£${total.toFixed(2)}** | |`,
    "",
    "## Volunteer rota",
    "| Role | From | To | Person |",
    "| --- | --- | --- | --- |",
    ...d.rota.data.map((r) => `| ${r.role} | ${t(r.start)} | ${t(r.end)} | ${r.person ?? "**needs a volunteer**"} |`),
  ].join("\n");
}

export const mockAnnouncement = (change: string, name: string) => `📣 Update for ${name}: ${change.trim().replace(/\.?$/, ".")} Thanks for bearing with us!`;

/** What's happening now and next on the run sheet. */
export function nowNext(kit: EventKit | undefined, now = Date.now()) {
  if (!kit) return { now: undefined, next: undefined };
  const rows = [...kit.items.runSheet.data].sort((a, b) => a.time.localeCompare(b.time));
  const i = rows.findIndex((r) => new Date(r.time).getTime() > now);
  return { now: i === -1 ? rows[rows.length - 1] : i > 0 ? rows[i - 1] : undefined, next: i === -1 ? undefined : rows[i] };
}

export { dayLabel, timeLabel };

import type { Activity, Attendee, DB, Photo, PhotoTag, Platform, ShareTask } from "./types";
import { leaderboard } from "./points";
import { parseSceneUrl } from "./scene";

/** Pure, isomorphic event logic shared by the API routes and the static (browser-only) demo. */

export const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;

export function logActivity(db: DB, a: Omit<Activity, "id" | "at">) {
  db.activity.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...a });
  db.activity = db.activity.slice(0, 200);
}

const COLORS = ["#f97316", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#facc15"];

export interface JoinInput {
  eventId: string;
  name?: string;
  xHandle?: string;
  email?: string;
  linkedin?: string;
  lookFor?: string;
  consentPhoto?: boolean;
  consentTag?: boolean;
}

export function joinEvent(db: DB, body: JoinInput): Attendee | null {
  const xHandle = String(body.xHandle ?? "").replace(/^@/, "").trim();
  if (!xHandle || !body.eventId) return null;
  let a = db.attendees.find((x) => x.eventId === body.eventId && x.xHandle.toLowerCase() === xHandle.toLowerCase());
  const fields = {
    name: String(body.name || xHandle),
    email: String(body.email ?? "").trim(),
    linkedin: String(body.linkedin ?? "").replace(/^.*linkedin\.com\/in\//, "").replace(/\/$/, ""),
    lookFor: String(body.lookFor ?? ""),
    consentPhoto: !!body.consentPhoto,
    consentTag: !!body.consentPhoto && !!body.consentTag,
  };
  if (a) Object.assign(a, fields);
  else {
    a = {
      id: uid("a"), eventId: body.eventId, xHandle, color: COLORS[db.attendees.length % COLORS.length],
      followersX: 500 + Math.floor(Math.random() * 4000), followersLinkedIn: 500 + Math.floor(Math.random() * 3000),
      role: "attendee", joinedAt: new Date().toISOString(), ...fields,
    };
    db.attendees.push(a);
    logActivity(db, { eventId: body.eventId, kind: "join", text: `@${xHandle} joined via QR`, attendeeId: a.id });
  }
  return a;
}

export function addPhoto(db: DB, me: Attendee, p: { id: string; url: string; caption: string; takenAt?: number }) {
  db.photos.unshift({
    id: p.id, eventId: me.eventId, url: p.url, uploaderId: me.id, caption: p.caption,
    takenAt: new Date(p.takenAt || Date.now()).toISOString(), uploadedAt: new Date().toISOString(),
    status: "pending", tags: [], withheld: [], hidden: false,
  });
  logActivity(db, { eventId: me.eventId, kind: "upload", text: `@${me.xHandle} uploaded "${p.caption}"`, attendeeId: me.id });
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Deterministic stand-in for Grok vision. Scene SVGs are matched by each attendee's outfit colour. */
export function mockIdentify(photo: Photo, roster: Attendee[], svg?: string): { matches: PhotoTag[]; note: string; place: string } {
  const bySvgColour = svg ? roster.filter((a) => svg.includes(`fill="${a.color}"`)).map((a) => a.id) : [];
  const ids =
    photo.groundTruth ??
    (bySvgColour.length ? bySvgColour : null) ??
    [photo.uploaderId, ...roster.filter((a) => a.id !== photo.uploaderId).sort((a, b) => hash(photo.id + a.id) - hash(photo.id + b.id)).slice(0, 2).map((a) => a.id)];
  const matches = ids
    .map((id) => roster.find((a) => a.id === id))
    .filter((a): a is Attendee => !!a)
    .map((a) => ({ attendeeId: a.id, confidence: 0.82 + (hash(photo.id + a.id) % 17) / 100, reason: `Matched "${a.lookFor}"` }));
  return { matches, note: `${matches.length} people detected · ${photo.caption}`, place: placeFor(photo) };
}

const SCENE_PLACES: Record<string, string> = { stage: "Main stage", desk: "Hack floor", crowd: "Kitchen & bar", board: "Whiteboard wall" };

/** Seeded scenes know where they were taken; real uploads default to the venue until Grok says otherwise. */
export function placeFor(photo: Photo) {
  return photo.url.startsWith("/scene/") ? (SCENE_PLACES[parseSceneUrl(photo.url).bg] ?? "The venue") : "The venue";
}

/** Apply model matches, enforcing consent in code so policy never depends on model output. */
export function applyTags(db: DB, eventId: string, photoId: string, r: { matches: PhotoTag[]; note: string; place?: string; caption?: string }) {
  const at = (id: string) => db.attendees.find((a) => a.id === id)!;
  const p = db.photos.find((x) => x.id === photoId)!;
  p.tags = [];
  p.withheld = [];
  for (const m of r.matches) {
    const a = at(m.attendeeId);
    if (!a) continue;
    if (!a.consentPhoto) p.withheld.push({ attendeeId: a.id, reason: "no-photo" });
    else if (!a.consentTag) p.withheld.push({ attendeeId: a.id, reason: "no-tag" });
    else p.tags.push(m);
  }
  // Scene photos can redact individuals; real uploads have no face boxes yet, so the whole photo is hidden.
  p.hidden = !p.url.startsWith("/scene/") && p.withheld.some((w) => w.reason === "no-photo");
  p.status = "tagged";
  p.grokNote = r.note;
  p.place = r.place ?? p.place ?? placeFor(p);
  if (r.caption && p.caption === "Event moment") p.caption = r.caption;
  logActivity(db, {
    eventId,
    kind: "tag",
    text: `Grok tagged ${p.tags.map((t) => "@" + at(t.attendeeId).xHandle).join(", ") || "nobody"} in "${p.caption}"${p.withheld.length ? ` · ${p.withheld.length} withheld for consent` : ""}`,
  });
}

const handle = (a: Attendee, platform: Platform) => (platform === "x" ? "@" + a.xHandle : a.name);

export function buildPlan(db: DB, eventId: string): { tasks: ShareTask[]; strategy: string } {
  const at = (id: string) => db.attendees.find((a) => a.id === id)!;
  const event = db.events.find((e) => e.id === eventId)!;
  const photos = db.photos.filter((p) => p.eventId === eventId && p.status === "tagged" && !p.hidden && p.tags.length > 0).sort((a, b) => b.tags.length - a.tags.length);
  const people = db.attendees.filter((a) => a.eventId === eventId && a.consentTag);
  const load = new Map<string, number>();
  const bump = (id: string) => load.set(id, (load.get(id) ?? 0) + 1);
  const tasks: ShareTask[] = [];
  const start = Date.now() + 2 * 60000;
  const t = (mins: number) => new Date(start + mins * 60000).toISOString();
  const usedAnchors = new Set<string>();

  photos.slice(0, 4).forEach((photo, i) => {
    const inPhoto = photo.tags.map((tg) => at(tg.attendeeId));
    const poster = [...inPhoto].filter((a) => !usedAnchors.has(a.id)).sort((a, b) => Math.max(b.followersX, b.followersLinkedIn) - Math.max(a.followersX, a.followersLinkedIn))[0] ?? at(photo.uploaderId);
    usedAnchors.add(poster.id);
    const platform: Platform = poster.followersLinkedIn > poster.followersX ? "linkedin" : "x";
    const others = inPhoto.filter((a) => a.id !== poster.id);
    const offset = i * 20;
    const anchor: ShareTask = {
      id: uid("t"), eventId, attendeeId: poster.id, type: "post", platform, scheduledAt: t(offset), photoId: photo.id,
      copy: `${photo.caption} at ${event.name} ${event.hashtag}${others.length ? ` with ${others.map((o) => handle(o, platform)).join(", ")}` : ""} 📸`,
      why: `Highest ${platform === "x" ? "X" : "LinkedIn"} reach among people in this photo (${(platform === "x" ? poster.followersX : poster.followersLinkedIn).toLocaleString()} followers). Slots are staggered 20 min apart so posts don't cannibalise each other.`,
      status: "todo",
    };
    tasks.push(anchor);
    bump(poster.id);
    others.slice(0, 3).forEach((o, j) => {
      tasks.push({
        id: uid("t"), eventId, attendeeId: o.id, type: "comment", platform, scheduledAt: t(offset + 4 + j * 3), photoId: photo.id, targetTaskId: anchor.id,
        copy: `So good building with ${handle(poster, platform)} tonight! ${j === 0 ? "Who else is shipping?" : "🔥"}`,
        why: "You're in the photo. Comments in the first 15 minutes are the strongest ranking signal.",
        status: "todo",
      });
      bump(o.id);
    });
    const amplifiers = people
      .filter((a) => !inPhoto.some((x) => x.id === a.id) && (load.get(a.id) ?? 0) < 3)
      .sort((a, b) => (platform === "x" ? b.followersX - a.followersX : b.followersLinkedIn - a.followersLinkedIn))
      .slice(0, 2);
    // Early upvotes from everyone else who opted in: the first 30 minutes decide a post's reach.
    people
      .filter((a) => a.id !== poster.id && !others.slice(0, 3).some((o) => o.id === a.id) && !amplifiers.some((x) => x.id === a.id) && (load.get(a.id) ?? 0) < 4)
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))
      .slice(0, 4)
      .forEach((fan, j) => {
        tasks.push({
          id: uid("t"), eventId, attendeeId: fan.id, type: "like", platform, scheduledAt: t(offset + 2 + j * 2), photoId: photo.id, targetTaskId: anchor.id,
          copy: "",
          why: "Upvote it in the first few minutes. Early likes tell the algorithm the post is worth showing.",
          status: "todo",
        });
        bump(fan.id);
      });
    amplifiers.forEach((amp, j) => {
      tasks.push({
        id: uid("t"), eventId, attendeeId: amp.id, type: "repost", platform, scheduledAt: t(offset + 30 + j * 15), photoId: photo.id, targetTaskId: anchor.id,
        copy: `Repost ${handle(poster, platform)}'s post: "Great energy at ${event.hashtag}, this is what community engineering looks like."`,
        why: `Second wave: your ${(platform === "x" ? amp.followersX : amp.followersLinkedIn).toLocaleString()} followers are a fresh audience, and a delayed repost extends the post's life.`,
        status: "todo",
      });
      bump(amp.id);
    });
  });

  const organiser = db.attendees.find((a) => a.xHandle === event.organiserHandle);
  if (organiser) {
    tasks.push({
      id: uid("t"), eventId, attendeeId: organiser.id, type: "post", platform: "linkedin", scheduledAt: t(100),
      copy: `What a night at ${event.name}! ${people.length} builders, ${db.photos.filter((p) => p.eventId === eventId).length} photos, all shared with consent by afterglow. Thank you to everyone who came ${event.hashtag}`,
      why: "Recap post after the waves land. It tags the top contributors and links back to every anchor post.",
      status: "todo",
    });
  }
  const strategy = `${photos.slice(0, 4).length} anchor posts staggered 20 min apart. Each gets early upvotes and comments from the people in the photo, then delayed reposts from high-reach attendees outside it. ${tasks.length} tasks across ${new Set(tasks.map((x) => x.attendeeId)).size} people, nobody given more than 4.`;
  return { tasks, strategy };
}

export function savePlan(db: DB, eventId: string, plan: { tasks: ShareTask[]; strategy: string }, source: "grok" | "mock") {
  db.tasks = db.tasks.filter((x) => x.eventId !== eventId || x.status === "done").concat(plan.tasks);
  db.plans[eventId] = { generatedAt: new Date().toISOString(), source, strategy: plan.strategy };
  logActivity(db, { eventId, kind: "plan", text: `Grok planned the sharing: ${plan.tasks.length} tasks across ${new Set(plan.tasks.map((t) => t.attendeeId)).size} people` });
  return plan.tasks.length;
}

const DID = { post: "posted", comment: "commented", repost: "reposted", like: "upvoted" } as const;

/** A reply, upvote or repost only makes sense once the post it points at is live. */
export function isLocked(db: DB, t: ShareTask) {
  if (!t.targetTaskId) return false;
  return db.tasks.find((x) => x.id === t.targetTaskId)?.status !== "done";
}

export function completeTask(db: DB, id: string, postUrl?: string) {
  const t = db.tasks.find((x) => x.id === id);
  if (!t || t.status === "done" || isLocked(db, t)) return false;
  t.status = "done";
  t.doneAt = new Date().toISOString();
  if (postUrl && /^https?:\/\//.test(postUrl)) t.postUrl = postUrl.trim();
  const a = db.attendees.find((x) => x.id === t.attendeeId);
  const target = t.targetTaskId ? db.attendees.find((x) => x.id === db.tasks.find((y) => y.id === t.targetTaskId)?.attendeeId) : undefined;
  const waiting = t.type === "post" ? db.tasks.filter((x) => x.targetTaskId === t.id).length : 0;
  logActivity(db, {
    eventId: t.eventId,
    kind: "task",
    text: `@${a?.xHandle} ${DID[t.type]}${target ? ` on @${target.xHandle}'s post` : ""} (${t.platform === "x" ? "X" : "LinkedIn"})${waiting ? `. ${waiting} people unlocked to engage` : ""}`,
    attendeeId: t.attendeeId,
  });
  return true;
}

export interface Moment {
  start: string;
  end: string;
  place: string;
  photos: Photo[];
  people: string[];
}

/** Group visible photos into moments: same place, no gap longer than 25 minutes. */
export function timeline(db: DB, eventId: string): Moment[] {
  const photos = db.photos.filter((p) => p.eventId === eventId && !p.hidden).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const out: Moment[] = [];
  for (const p of photos) {
    const place = p.place ?? placeFor(p);
    const last = out[out.length - 1];
    if (last && last.place === place && new Date(p.takenAt).getTime() - new Date(last.end).getTime() < 25 * 60000) {
      last.photos.push(p);
      last.end = p.takenAt;
    } else out.push({ start: p.takenAt, end: p.takenAt, place, photos: [p], people: [] });
  }
  for (const m of out) m.people = [...new Set(m.photos.flatMap((p) => p.tags.map((t) => t.attendeeId)))];
  return out;
}

export const BOT_HELP = "Commands: /stats · /tag · /plan · /nudge · /winners · /announce <message> · or ask anything";

/**
 * Handles console commands that don't need the model. Returns null for /tag, /plan
 * and free-text questions, which the caller routes to tagging, planning or Grok.
 */
export function botCommand(db: DB, eventId: string, command: string): string | null {
  const [cmd, ...rest] = command.trim().split(/\s+/);
  const arg = rest.join(" ");
  const event = db.events.find((e) => e.id === eventId)!;
  const name = (id: string) => db.attendees.find((a) => a.id === id);
  const board = leaderboard(db, eventId);
  const open = db.tasks.filter((t) => t.eventId === eventId && t.status === "todo");
  switch (cmd.toLowerCase()) {
    case "/help":
      return BOT_HELP;
    case "/stats":
      return botStats(db, eventId);
    case "/winners":
      return board.slice(0, 3).map((s, i) => `${["🥇", "🥈", "🥉"][i]} @${name(s.attendeeId)?.xHandle} with ${s.points} pts wins ${event.prizes[i]?.prize}`).join("\n");
    case "/nudge": {
      const due = open.filter((t) => new Date(t.scheduledAt).getTime() < Date.now() + 15 * 60000);
      const who = [...new Set(due.map((t) => "@" + name(t.attendeeId)?.xHandle))];
      return who.length ? `DM'd ${who.length} people with tasks due in the next 15 min: ${who.join(", ")}` : "Nobody has tasks due right now.";
    }
    case "/announce":
      return `📣 Announced to all attendees: "${arg}"`;
    default:
      return null;
  }
}

export function botStats(db: DB, eventId: string) {
  return `${db.attendees.filter((a) => a.eventId === eventId).length} attendees · ${db.photos.filter((p) => p.eventId === eventId).length} photos · ${db.tasks.filter((t) => t.eventId === eventId && t.status === "done").length} share tasks done · ${db.tasks.filter((t) => t.eventId === eventId && t.status === "todo").length} open`;
}

export function botContext(db: DB, eventId: string) {
  const event = db.events.find((e) => e.id === eventId)!;
  const top = leaderboard(db, eventId).slice(0, 3).map((s) => `@${db.attendees.find((a) => a.id === s.attendeeId)?.xHandle} ${s.points}pts`).join(", ");
  return `${event.name} ${event.hashtag}\n${botStats(db, eventId)}\nTop: ${top}`;
}

export function mockBotAnswer(context: string) {
  return `Grok (mock): Based on live data — ${context.split("\n").slice(0, 3).join(" · ")}. Suggestion: nudge people with open tasks and push the next anchor post now while engagement is high.`;
}

export function logBot(db: DB, eventId: string, command: string, reply: string) {
  logActivity(db, { eventId, kind: "bot", text: `Grok ${command.startsWith("/") ? command.split(/\s+/)[0] : "answered"}: ${reply.split("\n")[0].slice(0, 120)}` });
}

/**
 * A personal recap post from the photos someone is tagged in. Only people who are tagged
 * (and so consented to tagging) are mentioned.
 */
export function mockRecap(db: DB, eventId: string, meId: string) {
  const event = db.events.find((e) => e.id === eventId)!;
  const me = db.attendees.find((a) => a.id === meId)!;
  const photos = db.photos.filter((p) => p.eventId === eventId && !p.hidden && p.tags.some((t) => t.attendeeId === meId));
  const friends = [...new Set(photos.flatMap((p) => p.tags.map((t) => t.attendeeId)))].filter((id) => id !== meId).map((id) => db.attendees.find((a) => a.id === id)!).filter(Boolean);
  const moments = photos.slice(0, 2).map((p) => p.caption);
  const x = `Tonight at ${event.shortName ?? event.name}: ${moments.length ? moments.join(" → ") + " → " : ""}a lot of shipping.${friends.length ? ` Thanks ${friends.slice(0, 3).map((f) => "@" + f.xHandle).join(" ")}!` : ""} ${event.hashtag}`.slice(0, 280);
  const linkedin = `Just wrapped ${event.name} in ${event.venue}.\n\n${moments.length ? `Highlights: ${moments.join(", ")}. ` : ""}Great people, real builds and a room full of energy.${friends.length ? `\n\nThanks to ${friends.slice(0, 4).map((f) => f.name).join(", ")} for building alongside me.` : ""}\n\n${event.hashtag}`;
  return { x, linkedin, photoIds: photos.map((p) => p.id), mentions: friends.map((f) => f.id), by: me.id };
}

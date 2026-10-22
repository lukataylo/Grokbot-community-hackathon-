import fs from "node:fs";
import path from "node:path";
import { identifyPeople, polishCopy, grokMode } from "./grok";
import { logActivity, mutate, readDB, uid } from "./store";
import type { Attendee, DB, Photo, Platform, ShareTask } from "./types";

const at = (db: DB, id: string) => db.attendees.find((a) => a.id === id)!;

function imageDataUrl(photo: Photo): string | undefined {
  if (!photo.url.startsWith("/uploads/")) return undefined;
  const file = path.join(process.cwd(), "data", photo.url);
  if (!fs.existsSync(file)) return undefined;
  const ext = path.extname(file).slice(1).replace("jpg", "jpeg").replace("svg", "svg+xml");
  return `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`;
}

/** Run Grok matching, then enforce consent in code. */
export async function tagPhotos(eventId: string, photoIds?: string[]) {
  const db = readDB();
  const roster = db.attendees.filter((a) => a.eventId === eventId);
  const targets = db.photos.filter((p) => p.eventId === eventId && (photoIds ? photoIds.includes(p.id) : p.status === "pending"));
  const results = await Promise.all(targets.map(async (p) => ({ id: p.id, ...(await identifyPeople(p, roster, imageDataUrl(p))) })));
  return mutate((db) => {
    for (const r of results) {
      const p = db.photos.find((x) => x.id === r.id)!;
      p.tags = [];
      p.withheld = [];
      for (const m of r.matches) {
        const a = at(db, m.attendeeId);
        if (!a.consentPhoto) p.withheld.push({ attendeeId: a.id, reason: "no-photo" });
        else if (!a.consentTag) p.withheld.push({ attendeeId: a.id, reason: "no-tag" });
        else p.tags.push(m);
      }
      // Scene photos can redact individuals; real uploads have no face boxes yet, so the whole photo is hidden.
      p.hidden = !p.url.startsWith("/scene/") && p.withheld.some((w) => w.reason === "no-photo");
      p.status = "tagged";
      p.grokNote = r.note;
      logActivity(db, {
        eventId,
        kind: "tag",
        text: `Grok tagged ${p.tags.map((t) => "@" + at(db, t.attendeeId).xHandle).join(", ") || "nobody"} in "${p.caption}"${p.withheld.length ? ` · ${p.withheld.length} withheld for consent` : ""}`,
      });
    }
    return results.length;
  });
}

const handle = (a: Attendee, platform: Platform) => (platform === "x" ? "@" + a.xHandle : a.name);

export async function generatePlan(eventId: string) {
  const db = readDB();
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
    const inPhoto = photo.tags.map((tg) => at(db, tg.attendeeId));
    const poster = [...inPhoto].filter((a) => !usedAnchors.has(a.id)).sort((a, b) => Math.max(b.followersX, b.followersLinkedIn) - Math.max(a.followersX, a.followersLinkedIn))[0] ?? at(db, photo.uploaderId);
    usedAnchors.add(poster.id);
    const platform: Platform = poster.followersLinkedIn > poster.followersX ? "linkedin" : "x";
    const others = inPhoto.filter((a) => a.id !== poster.id);
    const offset = i * 20;
    const anchor: ShareTask = {
      id: uid("t"),
      eventId,
      attendeeId: poster.id,
      type: "post",
      platform,
      scheduledAt: t(offset),
      photoId: photo.id,
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
      copy: `What a night at ${event.name}! ${people.length} builders, ${db.photos.filter((p) => p.eventId === eventId).length} photos, all shared with consent by Grokbot. Thank you to everyone who came ${event.hashtag}`,
      why: "Recap post after the waves land. It tags the top contributors and links back to every anchor post.",
      status: "todo",
    });
  }

  const polished = await polishCopy(tasks.map((x) => ({ id: x.id, who: at(db, x.attendeeId).name, type: x.type, platform: x.platform, draft: x.copy })));
  for (const x of tasks) if (polished[x.id]) x.copy = polished[x.id];

  return mutate((db) => {
    db.tasks = db.tasks.filter((x) => x.eventId !== eventId || x.status === "done").concat(tasks);
    db.plans[eventId] = {
      generatedAt: new Date().toISOString(),
      source: grokMode(),
      strategy: `${photos.slice(0, 4).length} anchor posts staggered 20 min apart, each followed by early comments from people in the photo and delayed reposts from high-reach attendees outside it. ${tasks.length} tasks across ${new Set(tasks.map((x) => x.attendeeId)).size} people, with nobody given more than 4.`,
    };
    logActivity(db, { eventId, kind: "plan", text: `Grokbot generated a sharing plan: ${tasks.length} tasks` });
    return tasks.length;
  });
}

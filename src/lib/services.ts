import fs from "node:fs";
import path from "node:path";
import { identifyPeople, polishCopy, grokMode } from "./grok";
import { applyTags, buildPlan, savePlan } from "./engine";
import { mutate, readDB } from "./store";
import type { Photo } from "./types";

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

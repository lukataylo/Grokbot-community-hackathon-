import type { DB, KitKey } from "./types";
import { KIT_KEYS, KIT_LABEL } from "./kit";

/**
 * Minutes a volunteer would spend doing each piece by hand. These are the assumptions
 * behind the "volunteer hours saved" number; they are listed in the README.
 */
export const MANUAL_MINUTES: Record<KitKey, number> & { photoTag: number; sharePlan: number; announce: number; digest: number } = {
  page: 45,
  runSheet: 60,
  budget: 45,
  rota: 60,
  "post:linkedin": 20,
  "post:x": 20,
  "post:whatsapp": 20,
  "post:discord": 20,
  newsletter: 90,
  "visual:square": 30,
  "visual:story": 30,
  "visual:banner": 30,
  "visual:newsletter-header": 30,
  photoTag: 2,
  sharePlan: 30,
  announce: 10,
  digest: 120,
};

export interface HoursLine {
  label: string;
  minutes: number;
}

/** Credit a piece once the lead has approved or sent it: drafts nobody trusts save nobody time. */
export function hoursSaved(db: DB, eventId: string): { hours: number; lines: HoursLine[] } {
  const lines: HoursLine[] = [];
  const kit = db.kits?.[eventId];
  if (kit)
    for (const k of KIT_KEYS) if (kit.items[k].status !== "draft") lines.push({ label: KIT_LABEL[k], minutes: MANUAL_MINUTES[k] });
  const tagged = db.photos.filter((p) => p.eventId === eventId && p.status === "tagged").length;
  if (tagged) lines.push({ label: `Tagging ${tagged} photos`, minutes: tagged * MANUAL_MINUTES.photoTag });
  if (db.plans[eventId]?.approved) lines.push({ label: "Share coordination", minutes: MANUAL_MINUTES.sharePlan });
  const announced = db.activity.filter((a) => a.eventId === eventId && a.kind === "announce").length;
  if (announced) lines.push({ label: `${announced} last-minute update${announced > 1 ? "s" : ""}`, minutes: announced * MANUAL_MINUTES.announce });
  if (db.digest && db.digest.newsletter.status !== "draft") lines.push({ label: "Weekly digest", minutes: MANUAL_MINUTES.digest });
  return { hours: Math.round(lines.reduce((s, l) => s + l.minutes, 0) / 6) / 10, lines };
}

/** Hours the full kit would save if every piece were approved. */
export const KIT_POTENTIAL_HOURS = Math.round(KIT_KEYS.reduce((s, k) => s + MANUAL_MINUTES[k], 0) / 6) / 10;

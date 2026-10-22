import type { Attendee, DB, Photo } from "./types";
import { applyTags, buildPlan, completeTask, mockIdentify, savePlan } from "./engine";

export const EVENT_ID = "grokbot-london";
export const DEMO_ME = "a_luka";

const people: Omit<Attendee, "eventId" | "joinedAt">[] = [
  { id: "a_anna", name: "Anna Zhou", xHandle: "annazhou", linkedin: "annazhou", lookFor: "dark hair, black top", avatarUrl: "/demo/face-anna.jpg", color: "#f97316", followersX: 21400, followersLinkedIn: 9800, consentPhoto: true, consentTag: true, role: "speaker" },
  { id: "a_luka", name: "Luka Dadiani", xHandle: "lukataylo", linkedin: "lukadadiani", lookFor: "white t-shirt, glasses", avatarUrl: "/demo/face-luka.jpg", color: "#3b82f6", followersX: 6200, followersLinkedIn: 7400, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_sam", name: "Sam Reyes", xHandle: "samreyes", linkedin: "sam-reyes", lookFor: "glasses, grey t-shirt", avatarUrl: "/demo/face-sam.jpg", color: "#22c55e", followersX: 3900, followersLinkedIn: 5100, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_maya", name: "Maya King", xHandle: "mayabuilds", linkedin: "mayaking", lookFor: "curly hair, black blazer", avatarUrl: "/demo/face-maya.jpg", color: "#a855f7", followersX: 18400, followersLinkedIn: 12800, consentPhoto: true, consentTag: true, role: "organiser" },
  { id: "a_alex", name: "Alex Carter", xHandle: "alexships", linkedin: "alexcarter", lookFor: "curly hair, beard, navy t-shirt", avatarUrl: "/demo/face-alex.jpg", color: "#ef4444", followersX: 7600, followersLinkedIn: 4400, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_priya", name: "Priya Shah", xHandle: "priyaml", linkedin: "priyashah", lookFor: "long dark hair, grey cardigan", color: "#ec4899", followersX: 5400, followersLinkedIn: 8800, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_ben", name: "Ben Hughes", xHandle: "benhughes_dev", linkedin: "benhughes", lookFor: "short brown hair, navy jumper", color: "#eab308", followersX: 1300, followersLinkedIn: 2100, consentPhoto: true, consentTag: false, role: "attendee" },
  { id: "a_mei", name: "Mei Lin", xHandle: "meilin", linkedin: "meilin", lookFor: "white t-shirt, long dark hair", color: "#14b8a6", followersX: 9800, followersLinkedIn: 4300, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_kenji", name: "Kenji Tanaka", xHandle: "kenjit", linkedin: "kenjitanaka", lookFor: "glasses, black hoodie", color: "#0ea5e9", followersX: 4100, followersLinkedIn: 3600, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_noah", name: "Noah Williams", xHandle: "noahw", linkedin: "noahwilliams", lookFor: "black t-shirt, white headphones", color: "#64748b", followersX: 800, followersLinkedIn: 1200, consentPhoto: false, consentTag: false, role: "attendee" },
  { id: "a_ines", name: "Inês Costa", xHandle: "inescosta", linkedin: "inescosta", lookFor: "sky-blue shirt, ponytail", color: "#38bdf8", followersX: 3100, followersLinkedIn: 5600, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_omar", name: "Omar Haddad", xHandle: "omarhaddad", linkedin: "omar-haddad", lookFor: "maroon sweater, moustache", color: "#9f1239", followersX: 2200, followersLinkedIn: 7300, consentPhoto: true, consentTag: true, role: "attendee" },
];

const photos: { id: string; url: string; caption: string; by: string; minsAgo: number; who: string[] }[] = [
  { id: "p_pairing", url: "/demo/photo-1.jpg", caption: "Pairing on the Grok agent", by: "a_anna", minsAgo: 120, who: ["a_anna", "a_luka", "a_sam"] },
  { id: "p_keynote", url: "/demo/photo-2.jpg", caption: "Maya opening: Build with Grok", by: "a_luka", minsAgo: 150, who: ["a_maya"] },
  { id: "p_hallway", url: "/demo/photo-3.jpg", caption: "Hallway ideas over coffee", by: "a_anna", minsAgo: 90, who: ["a_ben", "a_priya"] },
  { id: "p_demo", url: "/demo/photo-4.jpg", caption: "First demo dry-run", by: "a_sam", minsAgo: 45, who: ["a_alex", "a_mei", "a_kenji"] },
];

export function buildSeed(): DB {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();
  const attendees: Attendee[] = people.map((p, i) => ({ ...p, eventId: EVENT_ID, joinedAt: iso(200 - i * 7) }));
  const seeded: Photo[] = photos.map((s) => ({
    id: s.id,
    eventId: EVENT_ID,
    url: s.url,
    uploaderId: s.by,
    caption: s.caption,
    takenAt: iso(s.minsAgo),
    uploadedAt: iso(s.minsAgo - 2),
    status: "pending",
    tags: [],
    withheld: [],
    hidden: false,
    groundTruth: s.who,
  }));
  const db: DB = {
    events: [
      {
        id: EVENT_ID,
        name: "Grok Bot Community Engineering Hackathon",
        shortName: "Grok Bot Hackathon",
        venue: "London",
        startsAt: iso(240),
        endsAt: new Date(now + 90 * 60000).toISOString(),
        hashtag: "#GrokBotLondon",
        organiserHandle: "mayabuilds",
        prizes: [
          { rank: "1st", prize: "Grok hoodie + xAI API credits" },
          { rank: "2nd", prize: "Cursor swag pack" },
          { rank: "3rd", prize: "Supabase stickers + mug" },
        ],
      },
    ],
    attendees,
    photos: seeded,
    tasks: [],
    plans: {},
    activity: attendees.slice(0, 6).map((a, i) => ({
      id: `seed_${i}`,
      eventId: EVENT_ID,
      at: a.joinedAt,
      kind: "join" as const,
      text: `@${a.xHandle} joined via QR`,
      attendeeId: a.id,
    })),
  };

  // Start the demo mid-event: photos already tagged, a plan running, a few shares done.
  for (const p of [...seeded].reverse()) applyTags(db, EVENT_ID, p.id, mockIdentify(p, attendees));
  savePlan(db, EVENT_ID, buildPlan(db, EVENT_ID), "mock");
  const mine = (id: string) => db.tasks.filter((t) => t.attendeeId === id);
  for (const t of mine("a_anna")) completeTask(db, t.id);
  for (const t of mine("a_luka").slice(0, -1)) completeTask(db, t.id);
  for (const t of mine("a_sam").slice(0, 1)) completeTask(db, t.id);
  for (const t of mine("a_maya").slice(0, 1)) completeTask(db, t.id);
  return db;
}

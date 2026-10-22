import type { Attendee, DB, KitKey, Photo } from "./types";
import { placeFor } from "./engine";
import { mockKit } from "./kit";

export const EVENT_ID = "grokbot-london";

const people: Omit<Attendee, "eventId" | "joinedAt">[] = [
  { id: "a_maya", name: "Maya Patel", xHandle: "mayabuilds", linkedin: "mayapatel", lookFor: "orange hoodie, long dark hair", color: "#f97316", followersX: 18400, followersLinkedIn: 9200, consentPhoto: true, consentTag: true, role: "organiser" },
  { id: "a_tom", name: "Tom Okafor", xHandle: "tomokafor", linkedin: "tom-okafor", lookFor: "blue denim jacket, glasses", color: "#3b82f6", followersX: 4200, followersLinkedIn: 6100, consentPhoto: true, consentTag: true, role: "speaker" },
  { id: "a_lena", name: "Lena Fischer", xHandle: "lenacodes", linkedin: "lenafischer", lookFor: "green bomber jacket, short blonde hair", color: "#22c55e", followersX: 2900, followersLinkedIn: 3400, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_raj", name: "Raj Mehta", xHandle: "rajships", linkedin: "rajmehta", lookFor: "purple t-shirt, beard", color: "#a855f7", followersX: 31200, followersLinkedIn: 12800, consentPhoto: true, consentTag: true, role: "speaker" },
  { id: "a_sofia", name: "Sofia Rossi", xHandle: "sofiaml", linkedin: "sofia-rossi", lookFor: "red dress, curly hair", color: "#ef4444", followersX: 7600, followersLinkedIn: 15400, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_ben", name: "Ben Carter", xHandle: "bencarter_dev", linkedin: "bencarter", lookFor: "yellow cap, grey t-shirt", color: "#eab308", followersX: 1300, followersLinkedIn: 2100, consentPhoto: true, consentTag: false, role: "attendee" },
  { id: "a_aisha", name: "Aisha Bello", xHandle: "aishab", linkedin: "aishabello", lookFor: "pink blazer, headscarf", color: "#ec4899", followersX: 5400, followersLinkedIn: 8800, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_kenji", name: "Kenji Tanaka", xHandle: "kenjit", linkedin: "kenjitanaka", lookFor: "teal jumper, man bun", color: "#14b8a6", followersX: 9800, followersLinkedIn: 4300, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_noah", name: "Noah Williams", xHandle: "noahw", linkedin: "noahwilliams", lookFor: "black t-shirt, white headphones", color: "#64748b", followersX: 800, followersLinkedIn: 1200, consentPhoto: false, consentTag: false, role: "attendee" },
  { id: "a_ines", name: "Inês Costa", xHandle: "inescosta", linkedin: "inescosta", lookFor: "sky-blue shirt, ponytail", color: "#38bdf8", followersX: 3100, followersLinkedIn: 5600, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_omar", name: "Omar Haddad", xHandle: "omarhaddad", linkedin: "omar-haddad", lookFor: "maroon sweater, moustache", color: "#9f1239", followersX: 2200, followersLinkedIn: 7300, consentPhoto: true, consentTag: true, role: "attendee" },
  { id: "a_chloe", name: "Chloe Martin", xHandle: "chloebuilds", linkedin: "chloemartin", lookFor: "lime raincoat, bob haircut", color: "#84cc16", followersX: 6600, followersLinkedIn: 3900, consentPhoto: true, consentTag: true, role: "attendee" },
];

const scenes: { id: string; caption: string; by: string; minsAgo: number; who: string[]; bg: string }[] = [
  { id: "p_doors", caption: "Doors open, QR check-in", by: "a_maya", minsAgo: 185, who: ["a_ines", "a_omar", "a_chloe"], bg: "crowd" },
  { id: "p_keynote", caption: "Raj's opening keynote on Grok agents", by: "a_maya", minsAgo: 150, who: ["a_raj", "a_tom"], bg: "stage" },
  { id: "p_team1", caption: "Team 'Consent Cam' mid-build", by: "a_lena", minsAgo: 120, who: ["a_lena", "a_kenji", "a_ines", "a_ben"], bg: "desk" },
  { id: "p_hacking", caption: "Hacking in full swing", by: "a_ines", minsAgo: 112, who: ["a_ines", "a_sofia", "a_raj"], bg: "desk" },
  { id: "p_pizza", caption: "Pizza o'clock", by: "a_tom", minsAgo: 100, who: ["a_sofia", "a_aisha", "a_omar", "a_noah"], bg: "crowd" },
  { id: "p_whiteboard", caption: "Whiteboarding the architecture", by: "a_kenji", minsAgo: 80, who: ["a_kenji", "a_chloe", "a_maya"], bg: "board" },
  { id: "p_selfie", caption: "Organiser selfie with the speakers", by: "a_maya", minsAgo: 60, who: ["a_maya", "a_raj", "a_tom", "a_sofia", "a_lena"], bg: "crowd" },
  { id: "p_debug", caption: "Late-night debugging", by: "a_kenji", minsAgo: 14, who: ["a_kenji", "a_tom", "a_lena"], bg: "desk" },
  { id: "p_demo", caption: "First demo dry-run", by: "a_aisha", minsAgo: 30, who: ["a_aisha", "a_chloe", "a_omar"], bg: "stage" },
];

export const SEED_IDEA = "Grok Bot community engineering hackathon tonight at Expedite London HQ for 60 builders with pizza";

export const SEED_DUMP = `Venue hire from Expedite, sponsored £0 quote
Pizza for 60 from Franco Manca £420 receipt
Drinks from Beer52 £150 quote
Lanyards and badges via Moo £36 paid
Volunteers: Lena, Kenji, Inês, Omar
Speakers: Raj Mehta, Tom Okafor
Step-free access via the side entrance on Lyric Square.`;

export function buildSeed(): DB {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();
  // A kit for tonight that the lead has partly approved, so the demo opens mid-flow.
  const kit = mockKit({
    eventId: EVENT_ID,
    idea: SEED_IDEA,
    dump: SEED_DUMP,
    facts: { name: "Grok Bot Community Engineering Hackathon", startsAt: iso(240), endsAt: new Date(now + 90 * 60000).toISOString(), venue: "Expedite London HQ, 7 Lyric Square", hashtag: "#GrokBotLondon" },
  }, new Date(now));
  for (const k of ["page", "runSheet", "budget", "rota", "post:linkedin"] as KitKey[]) kit.items[k].status = "approved";
  const attendees: Attendee[] = people.map((p, i) => ({ ...p, eventId: EVENT_ID, joinedAt: iso(200 - i * 7) }));
  const photos: Photo[] = scenes.map((s) => ({
    id: s.id,
    eventId: EVENT_ID,
    url: `/scene/${s.id}?bg=${s.bg}&who=${s.who.join(",")}`,
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
  for (const p of photos) p.place = placeFor(p);
  return {
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
    photos,
    tasks: [],
    plans: {},
    kits: { [EVENT_ID]: kit },
    activity: attendees.slice(0, 6).map((a, i) => ({
      id: `seed_${i}`,
      eventId: EVENT_ID,
      at: a.joinedAt,
      kind: "join" as const,
      text: `@${a.xHandle} joined via QR`,
      attendeeId: a.id,
    })),
  };
}

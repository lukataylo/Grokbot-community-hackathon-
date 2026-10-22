export type Platform = "x" | "linkedin";
export type TaskType = "post" | "comment" | "repost";

export interface EventInfo {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  hashtag: string;
  organiserHandle: string;
  prizes: { rank: string; prize: string }[];
}

export interface Attendee {
  id: string;
  eventId: string;
  name: string;
  xHandle: string;
  linkedin: string;
  /** Self-described appearance Grok uses to match people in photos. */
  lookFor: string;
  color: string;
  followersX: number;
  followersLinkedIn: number;
  consentPhoto: boolean;
  consentTag: boolean;
  role: "attendee" | "organiser" | "speaker";
  joinedAt: string;
}

export interface PhotoTag {
  attendeeId: string;
  confidence: number;
  reason: string;
}

export interface Photo {
  id: string;
  eventId: string;
  url: string;
  uploaderId: string;
  caption: string;
  takenAt: string;
  uploadedAt: string;
  status: "pending" | "tagged";
  tags: PhotoTag[];
  /** People Grok recognised but did not tag because of their consent settings. */
  withheld: { attendeeId: string; reason: "no-tag" | "no-photo" }[];
  hidden: boolean;
  grokNote?: string;
  /** Demo-only: who is actually in a seeded SVG scene. */
  groundTruth?: string[];
}

export interface ShareTask {
  id: string;
  eventId: string;
  attendeeId: string;
  type: TaskType;
  platform: Platform;
  scheduledAt: string;
  photoId?: string;
  targetTaskId?: string;
  copy: string;
  why: string;
  status: "todo" | "done";
  doneAt?: string;
}

export interface Plan {
  generatedAt: string;
  strategy: string;
  source: "grok" | "mock";
  /** Attendees only see their share tasks once the lead approves the plan. */
  approved?: boolean;
  approvedAt?: string;
}

export interface Activity {
  id: string;
  eventId: string;
  at: string;
  kind: "join" | "upload" | "tag" | "task" | "bot" | "plan" | "kit" | "announce";
  text: string;
  attendeeId?: string;
}

export interface DB {
  events: EventInfo[];
  attendees: Attendee[];
  photos: Photo[];
  tasks: ShareTask[];
  plans: Record<string, Plan>;
  kits: Record<string, EventKit>;
  digest?: Digest;
  activity: Activity[];
}

// ---- Event Autopilot ----

export type KitStatus = "draft" | "approved" | "sent";
export type Channel = "linkedin" | "x" | "whatsapp" | "discord";
export type VisualFormat = "square" | "story" | "banner" | "newsletter-header";

export interface RunSheetRow {
  time: string;
  item: string;
  owner: string;
  notes: string;
}

export interface BudgetLine {
  item: string;
  supplier: string;
  cost: number;
  source: "receipt" | "quote" | "estimate";
}

export interface RotaSlot {
  role: string;
  start: string;
  end: string;
  person?: string;
}

export interface KitData {
  page: { title: string; tagline: string; description: string; agenda: string[] };
  runSheet: RunSheetRow[];
  budget: BudgetLine[];
  rota: RotaSlot[];
  "post:linkedin": { text: string };
  "post:x": { text: string };
  "post:whatsapp": { text: string };
  "post:discord": { text: string };
  newsletter: { subject: string; preheader: string; html: string };
  "visual:square": { headline: string };
  "visual:story": { headline: string };
  "visual:banner": { headline: string };
  "visual:newsletter-header": { headline: string };
}

export type KitKey = keyof KitData;

export interface KitItem<T> {
  status: KitStatus;
  data: T;
  /** Bumped on every regenerate so the mock writer can produce a different draft. */
  variant: number;
  edited?: boolean;
  sentAt?: string;
  sentVia?: string;
}

export type KitItems = { [K in KitKey]: KitItem<KitData[K]> };

export interface Brand {
  community: string;
  primary: string;
  accent: string;
  background: string;
  font: "sans" | "serif" | "mono";
}

export interface KitFacts {
  name: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  hosts: string[];
  headcount: number;
  url?: string;
  hashtag: string;
}

export interface EventKit {
  eventId: string;
  idea: string;
  dump: string;
  generatedAt: string;
  source: "grok" | "mock";
  luma?: { id: string; ok: boolean };
  /** Event description pulled from Luma, preferred over the written one. */
  lumaDescription?: string;
  facts: KitFacts;
  brand: Brand;
  items: KitItems;
  publishedAt?: string;
}

export interface DigestEvent {
  start: string;
  title: string;
  location: string;
  url: string;
}

export interface Digest {
  calendar: string;
  feed: "luma" | "sample";
  generatedAt: string;
  events: DigestEvent[];
  newsletter: KitItem<{ subject: string; html: string }>;
  whatsapp: KitItem<{ text: string }>;
}

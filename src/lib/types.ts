export type Platform = "x" | "linkedin";
export type TaskType = "post" | "comment" | "repost";

export interface EventInfo {
  id: string;
  name: string;
  shortName?: string;
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
  email?: string;
  avatarUrl?: string;
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
}

export interface Activity {
  id: string;
  eventId: string;
  at: string;
  kind: "join" | "upload" | "tag" | "task" | "bot" | "plan";
  text: string;
  attendeeId?: string;
}

export interface DB {
  events: EventInfo[];
  attendees: Attendee[];
  photos: Photo[];
  tasks: ShareTask[];
  plans: Record<string, Plan>;
  activity: Activity[];
}

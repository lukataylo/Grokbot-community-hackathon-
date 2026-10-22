import type { DB } from "./types";

export const POINTS = { upload: 10, tagged: 2, post: 25, comment: 5, repost: 10 } as const;

export interface Score {
  attendeeId: string;
  points: number;
  uploads: number;
  tagged: number;
  posts: number;
  comments: number;
  reposts: number;
  reach: number;
}

export function leaderboard(db: DB, eventId: string): Score[] {
  const scores = new Map<string, Score>();
  for (const a of db.attendees.filter((a) => a.eventId === eventId)) {
    scores.set(a.id, { attendeeId: a.id, points: 0, uploads: 0, tagged: 0, posts: 0, comments: 0, reposts: 0, reach: 0 });
  }
  for (const p of db.photos.filter((p) => p.eventId === eventId)) {
    const s = scores.get(p.uploaderId);
    if (s) s.uploads++;
    for (const t of p.tags) {
      const ts = scores.get(t.attendeeId);
      if (ts) ts.tagged++;
    }
  }
  for (const t of db.tasks.filter((t) => t.eventId === eventId && t.status === "done")) {
    const s = scores.get(t.attendeeId);
    const a = db.attendees.find((x) => x.id === t.attendeeId);
    if (!s || !a) continue;
    if (t.type === "post") s.posts++;
    if (t.type === "comment") s.comments++;
    if (t.type === "repost") s.reposts++;
    s.reach += t.platform === "x" ? a.followersX : a.followersLinkedIn;
  }
  for (const s of scores.values()) {
    s.points = s.uploads * POINTS.upload + s.tagged * POINTS.tagged + s.posts * POINTS.post + s.comments * POINTS.comment + s.reposts * POINTS.repost;
  }
  return [...scores.values()].sort((a, b) => b.points - a.points || b.reach - a.reach);
}

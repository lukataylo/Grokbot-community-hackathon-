import { NextResponse } from "next/server";
import { logActivity, mutate, uid } from "@/lib/store";
import { SESSION_COOKIE } from "@/lib/session";

const COLORS = ["#f97316", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#facc15"];

export async function POST(req: Request) {
  const body = await req.json();
  const xHandle = String(body.xHandle ?? "").replace(/^@/, "").trim();
  if (!xHandle || !body.eventId) return NextResponse.json({ error: "X handle required" }, { status: 400 });
  const attendee = mutate((db) => {
    let a = db.attendees.find((x) => x.eventId === body.eventId && x.xHandle.toLowerCase() === xHandle.toLowerCase());
    const fields = {
      name: String(body.name || xHandle),
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
  });
  const res = NextResponse.json({ attendee });
  res.cookies.set(SESSION_COOKIE, attendee.id, { path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}

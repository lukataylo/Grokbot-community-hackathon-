import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Demo shortcut standing in for X OAuth: sign in as a seeded attendee. */
export async function POST(req: Request) {
  const { attendeeId } = await req.json();
  const res = NextResponse.json({ ok: true });
  if (attendeeId) res.cookies.set(SESSION_COOKIE, attendeeId, { path: "/", maxAge: 60 * 60 * 24 * 7 });
  else res.cookies.delete(SESSION_COOKIE);
  return res;
}

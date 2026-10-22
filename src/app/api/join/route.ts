import { NextResponse } from "next/server";
import { joinEvent } from "@/lib/engine";
import { mutate } from "@/lib/store";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json();
  const attendee = mutate((db) => joinEvent(db, body));
  if (!attendee) return NextResponse.json({ error: "X handle required" }, { status: 400 });
  const res = NextResponse.json({ attendee });
  res.cookies.set(SESSION_COOKIE, attendee.id, { path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}

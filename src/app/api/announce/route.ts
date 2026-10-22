import { NextResponse } from "next/server";
import { announce } from "@/lib/services";

export async function POST(req: Request) {
  const { eventId, change } = await req.json();
  if (!String(change ?? "").trim()) return NextResponse.json({ error: "Describe the change" }, { status: 400 });
  return NextResponse.json(await announce(eventId, String(change)));
}

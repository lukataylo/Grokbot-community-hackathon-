import { NextResponse } from "next/server";
import { buildDigest } from "@/lib/services";
import { DEFAULT_CALENDAR } from "@/lib/digest";

export async function POST(req: Request) {
  const { calendar, community } = await req.json();
  const d = await buildDigest(String(calendar || DEFAULT_CALENDAR), String(community || "the community"));
  return NextResponse.json({ feed: d.feed, events: d.events.length });
}

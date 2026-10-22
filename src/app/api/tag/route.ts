import { NextResponse } from "next/server";
import { tagPhotos } from "@/lib/services";
import { readDB } from "@/lib/store";

export async function POST(req: Request) {
  const { eventId, photoIds, all } = await req.json();
  const ids = all ? readDB().photos.filter((p) => p.eventId === eventId).map((p) => p.id) : photoIds;
  const count = await tagPhotos(eventId, ids);
  return NextResponse.json({ count });
}

import { NextResponse } from "next/server";
import { publishKit } from "@/lib/services";

export async function POST(req: Request) {
  const { eventId, all } = await req.json();
  return NextResponse.json(await publishKit(eventId, !!all));
}

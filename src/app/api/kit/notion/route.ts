import { NextResponse } from "next/server";
import { exportNotion } from "@/lib/services";

export async function POST(req: Request) {
  const { eventId } = await req.json();
  return NextResponse.json(await exportNotion(eventId));
}

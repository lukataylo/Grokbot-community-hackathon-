import { NextResponse } from "next/server";
import { generatePlan } from "@/lib/services";

export async function POST(req: Request) {
  const { eventId } = await req.json();
  return NextResponse.json({ count: await generatePlan(eventId) });
}

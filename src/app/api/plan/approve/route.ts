import { NextResponse } from "next/server";
import { approvePlan } from "@/lib/kit";
import { mutate } from "@/lib/store";

export async function POST(req: Request) {
  const { eventId } = await req.json();
  return NextResponse.json({ ok: mutate((db) => approvePlan(db, eventId)) });
}

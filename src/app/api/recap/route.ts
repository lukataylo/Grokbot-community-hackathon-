import { NextResponse } from "next/server";
import { currentAttendee } from "@/lib/session";
import { mockRecap } from "@/lib/engine";
import { writeRecap } from "@/lib/grok";
import { readDB } from "@/lib/store";

export async function POST(req: Request) {
  const { eventId } = await req.json();
  const me = await currentAttendee();
  if (!me) return NextResponse.json({ recap: null }, { status: 401 });
  const draft = mockRecap(readDB(), eventId, me.id);
  const recap = await writeRecap(draft, `${me.name} at event ${eventId}`);
  return NextResponse.json({ recap });
}

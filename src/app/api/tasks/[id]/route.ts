import { NextResponse } from "next/server";
import { logActivity, mutate } from "@/lib/store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = mutate((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t || t.status === "done") return false;
    t.status = "done";
    t.doneAt = new Date().toISOString();
    const a = db.attendees.find((x) => x.id === t.attendeeId);
    logActivity(db, { eventId: t.eventId, kind: "task", text: `@${a?.xHandle} completed a ${t.type} on ${t.platform === "x" ? "X" : "LinkedIn"}`, attendeeId: t.attendeeId });
    return true;
  });
  return NextResponse.json({ ok });
}

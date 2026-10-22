import { NextResponse } from "next/server";
import { completeTask } from "@/lib/engine";
import { mutate } from "@/lib/store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ ok: mutate((db) => completeTask(db, id)) });
}

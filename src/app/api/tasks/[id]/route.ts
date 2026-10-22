import { NextResponse } from "next/server";
import { completeTask } from "@/lib/engine";
import { mutate } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { postUrl } = (await req.json().catch(() => ({}))) as { postUrl?: string };
  return NextResponse.json({ ok: mutate((db) => completeTask(db, id, postUrl)) });
}

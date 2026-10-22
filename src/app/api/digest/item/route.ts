import { NextResponse } from "next/server";
import { updateDigest } from "@/lib/digest";
import { mutate } from "@/lib/store";

export async function POST(req: Request) {
  const { part, status, text, subject } = await req.json();
  return NextResponse.json({ ok: mutate((db) => updateDigest(db, part, { status, text, subject })) });
}

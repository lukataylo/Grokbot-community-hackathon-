import { NextResponse } from "next/server";
import { setBrand } from "@/lib/kit";
import { mutate } from "@/lib/store";

export async function POST(req: Request) {
  const { eventId, brand } = await req.json();
  return NextResponse.json({ ok: mutate((db) => setBrand(db, eventId, brand)) });
}

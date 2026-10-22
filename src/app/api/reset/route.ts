import { NextResponse } from "next/server";
import { resetDB } from "@/lib/store";

export async function POST() {
  resetDB();
  return NextResponse.json({ ok: true });
}

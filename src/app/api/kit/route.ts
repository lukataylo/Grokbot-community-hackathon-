import { NextResponse } from "next/server";
import { generateKit } from "@/lib/services";

export async function POST(req: Request) {
  const { eventId, idea, dump, luma, brand } = await req.json();
  if (!eventId || !String(idea ?? "").trim()) return NextResponse.json({ error: "Give Autopilot a one-line idea" }, { status: 400 });
  const kit = await generateKit({ eventId, idea: String(idea), dump: String(dump ?? ""), luma: luma ? String(luma) : undefined, brand });
  return NextResponse.json({ source: kit.source, luma: kit.luma });
}

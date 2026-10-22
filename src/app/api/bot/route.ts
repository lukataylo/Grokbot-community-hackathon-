import { NextResponse } from "next/server";
import { botAnswer } from "@/lib/grok";
import { botCommand, botContext, logBot } from "@/lib/engine";
import { generatePlan, tagPhotos } from "@/lib/services";
import { mutate, readDB } from "@/lib/store";

export async function POST(req: Request) {
  const { eventId, command } = (await req.json()) as { eventId: string; command: string };
  const cmd = command.trim().split(/\s+/)[0].toLowerCase();
  const db = readDB();
  let reply = botCommand(db, eventId, command);
  if (reply === null) {
    if (cmd === "/tag") reply = `Tagged ${await tagPhotos(eventId)} new photos. Consent rules applied.`;
    else if (cmd === "/plan") reply = `Sharing plan ready: ${await generatePlan(eventId)} tasks scheduled. Open the Plan tab.`;
    else reply = await botAnswer(command, botContext(db, eventId));
  }
  mutate((d) => logBot(d, eventId, command, reply));
  return NextResponse.json({ reply });
}

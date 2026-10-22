import { NextResponse } from "next/server";
import { botAnswer } from "@/lib/grok";
import { leaderboard } from "@/lib/points";
import { generatePlan, tagPhotos } from "@/lib/services";
import { logActivity, mutate, readDB } from "@/lib/store";

const HELP = "Commands: /stats · /tag · /plan · /nudge · /winners · /announce <message> · or ask anything";

export async function POST(req: Request) {
  const { eventId, command } = (await req.json()) as { eventId: string; command: string };
  const [cmd, ...rest] = command.trim().split(/\s+/);
  const arg = rest.join(" ");
  const db = readDB();
  const event = db.events.find((e) => e.id === eventId)!;
  const name = (id: string) => db.attendees.find((a) => a.id === id);
  const board = leaderboard(db, eventId);
  const open = db.tasks.filter((t) => t.eventId === eventId && t.status === "todo");
  const stats = `${db.attendees.filter((a) => a.eventId === eventId).length} attendees · ${db.photos.filter((p) => p.eventId === eventId).length} photos · ${db.tasks.filter((t) => t.eventId === eventId && t.status === "done").length} share tasks done · ${open.length} open`;
  let reply: string;

  switch (cmd.toLowerCase()) {
    case "/help":
      reply = HELP;
      break;
    case "/stats":
      reply = stats;
      break;
    case "/tag":
      reply = `Tagged ${await tagPhotos(eventId)} new photos. Consent rules applied.`;
      break;
    case "/plan":
      reply = `Sharing plan ready: ${await generatePlan(eventId)} tasks scheduled. Open the Plan tab.`;
      break;
    case "/winners":
      reply = board.slice(0, 3).map((s, i) => `${["🥇", "🥈", "🥉"][i]} @${name(s.attendeeId)?.xHandle} with ${s.points} pts wins ${event.prizes[i]?.prize}`).join("\n");
      break;
    case "/nudge": {
      const due = open.filter((t) => new Date(t.scheduledAt).getTime() < Date.now() + 15 * 60000);
      const who = [...new Set(due.map((t) => "@" + name(t.attendeeId)?.xHandle))];
      reply = who.length ? `DM'd ${who.length} people with tasks due in the next 15 min: ${who.join(", ")}` : "Nobody has tasks due right now.";
      break;
    }
    case "/announce":
      reply = `📣 Announced to all attendees: "${arg}"`;
      break;
    default: {
      const top = board.slice(0, 3).map((s) => `@${name(s.attendeeId)?.xHandle} ${s.points}pts`).join(", ");
      reply = await botAnswer(command, `${event.name} ${event.hashtag}\n${stats}\nTop: ${top}`);
    }
  }
  mutate((d) => logActivity(d, { eventId, kind: "bot", text: `Grokbot ${cmd.startsWith("/") ? cmd : "answered"}: ${reply.split("\n")[0].slice(0, 120)}` }));
  return NextResponse.json({ reply });
}

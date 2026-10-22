import Link from "next/link";
import { EVENT_ID } from "@/lib/seed";
import { GrokMark } from "@/components/ui";

const steps = [
  ["Autopilot", "Drop in a one-line idea, a Luma link and your notes and receipts. Grokbot drafts the run sheet, budget, rota, posts, visuals and newsletter. You approve each one, or all of them in one click."],
  ["Scan & consent", "Attendees scan a QR, sign in with X, add their LinkedIn and choose whether they can be photographed or tagged."],
  ["Upload", "Everyone drops their photos into one shared event gallery."],
  ["Grok tags", "Grok matches the people who opted in and delivers each photo to the people in it. Opted-out people are never tagged."],
  ["Coordinated reach", "Grokbot schedules who posts, who comments and who reposts whom across X and LinkedIn, with copy ready to go."],
  ["Leaderboard", "Points for photos, posts, comments and reposts. Top contributors win prizes."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
        <GrokMark className="h-3 w-3" /> Grok Bot Community Engineering · London
      </div>
      <h1 className="max-w-3xl text-5xl font-black tracking-tight sm:text-6xl">
        One event idea in. <span className="bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">Run sheet, visuals, posts and newsletter</span> out.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-zinc-400">
        Grokbot does the weekly admin that burns out volunteers, before the event, on the night and after it. Nothing goes out until the lead approves it, and every approval shows up as volunteer hours saved.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/organiser/${EVENT_ID}/autopilot`} className="btn-grok px-6 py-3 text-base">
          Open Event Autopilot
        </Link>
        <Link href={`/join/${EVENT_ID}`} className="btn-ghost px-6 py-3 text-base">
          Join as attendee
        </Link>
        <Link href={`/organiser/${EVENT_ID}`} className="btn-ghost px-6 py-3 text-base">
          Organiser dashboard
        </Link>
        <Link href={`/e/${EVENT_ID}`} className="btn-ghost px-6 py-3 text-base">
          Event gallery
        </Link>
      </div>
      <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="card p-4">
            <span className="text-xs font-mono text-fuchsia-300">0{i + 1}</span>
            <p className="mt-1 font-semibold">{t}</p>
            <p className="mt-1 text-sm text-zinc-400">{d}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}

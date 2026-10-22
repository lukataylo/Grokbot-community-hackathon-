import Link from "next/link";
import { EVENT_ID } from "@/lib/seed";
import { GrokMark } from "@/components/ui";

const steps = [
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
        Every event photo, <span className="bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">tagged with consent</span> and shared for maximum reach.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-zinc-400">
        Grokbot turns a pile of camera rolls into a coordinated community launch, with no manual tagging, no lost photos and no posting into the void.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/join/${EVENT_ID}`} className="btn-grok px-6 py-3 text-base">
          Join as attendee
        </Link>
        <Link href={`/organiser/${EVENT_ID}`} className="btn-ghost px-6 py-3 text-base">
          Organiser dashboard
        </Link>
        <Link href={`/e/${EVENT_ID}`} className="btn-ghost px-6 py-3 text-base">
          Event gallery
        </Link>
      </div>
      <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

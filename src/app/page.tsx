import Link from "next/link";
import { EVENT_ID } from "@/lib/seed";
import { Mascot, Wordmark } from "@/components/ui";

const steps = [
  ["Plan", "Drop in a one-line idea, a Luma link and your receipts. Grok drafts the run sheet, budget and volunteer rota."],
  ["Promo", "Posts for LinkedIn, X, WhatsApp and Discord, a Ghost newsletter and on-brand visuals. You approve each one, or all of them in one click."],
  ["On the night", "QR check-in with consent, Now / Next from the run sheet, and last-minute changes pushed to the group."],
  ["Afterglow", "Everyone uploads photos. Grok tags the people who said yes, plans who shares what, and keeps score."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Wordmark className="text-3xl" />
      <section className="mt-10 grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="eyebrow">Event Autopilot for community leads</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            One idea in.
            <br />
            <span className="text-glow-deep">Run sheet, visuals, posts and newsletter</span> out.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            afterglow does the weekly admin that burns out volunteers: before the event, on the night and after it. Nothing goes out until you approve it, and every approval counts as volunteer hours saved.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/organiser/${EVENT_ID}/autopilot`} className="btn-primary px-6 py-3.5 text-base">
              Open Event Autopilot
            </Link>
            <Link href={`/join/${EVENT_ID}`} className="btn-grok px-6 py-3.5 text-base">
              Join tonight&apos;s event
            </Link>
            <Link href={`/organiser/${EVENT_ID}`} className="btn-ghost px-6 py-3.5 text-base">
              Organiser dashboard
            </Link>
          </div>
        </div>
        <div className="relative grid place-items-center rounded-[2.5rem] bg-gradient-to-br from-[#6cc8ff] to-[#3fb3fa] p-10">
          <Mascot className="w-full max-w-md" />
        </div>
      </section>
      <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="card p-5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-glow-soft text-sm font-bold">{i + 1}</span>
            <p className="mt-3 font-bold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}

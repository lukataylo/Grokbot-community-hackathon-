import Link from "next/link";
import { EVENT_ID } from "@/lib/seed";
import { Logo, Mascot } from "@/components/ui";

const steps = [
  ["Scan & consent", "Scan the event QR, sign in with X, add LinkedIn and choose whether you can be photographed or tagged."],
  ["Upload", "Everyone drops their photos into one shared event gallery."],
  ["Grok tags", "Grok finds the people who opted in and sends each photo to the people in it. Anyone who opted out is never tagged."],
  ["Coordinated reach", "Grok schedules who posts, who comments and who reposts whom across X and LinkedIn, with copy ready to go."],
  ["Leaderboard", "Points for photos, posts, comments and reposts. Top contributors win community merch."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Logo className="text-3xl" />
      <section className="relative mt-8 overflow-hidden rounded-[40px] bg-gradient-to-br from-[#6ac2fa] to-sky px-8 py-12 md:px-14 md:py-16">
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow text-navy/70">Grok Bot Hackathon · London</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight text-navy md:text-6xl">Every event photo, shared with consent.</h1>
          <p className="mt-4 text-lg font-medium text-navy/75">
            afterglow turns a pile of camera rolls into a coordinated community launch, with no manual tagging, no lost photos and no posting into the void.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/join/${EVENT_ID}`} className="btn-primary px-7 py-3.5 text-base">
              Join tonight →
            </Link>
            <Link href={`/organiser/${EVENT_ID}`} className="btn-ghost px-7 py-3.5 text-base">
              Organiser dashboard
            </Link>
            <Link href={`/e/${EVENT_ID}`} className="btn-ghost px-7 py-3.5 text-base">
              Event photos
            </Link>
          </div>
        </div>
        <Mascot pose="wave" className="absolute -bottom-6 right-4 hidden w-[420px] md:block" />
      </section>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(([t, d], i) => (
          <li key={t} className="card p-5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-soft text-sm font-bold text-navy">{i + 1}</span>
            <p className="mt-3 font-bold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}

import Link from "next/link";
import { EVENT_ID } from "@/lib/seed";
import { Mascot, Wordmark } from "@/components/ui";

const steps = [
  ["Scan & choose", "Attendees scan the QR, add their X and LinkedIn, and say whether they can be photographed and tagged."],
  ["Everyone uploads", "One shared gallery instead of 40 camera rolls. No more “can you send me that photo?”"],
  ["Grok finds you", "Grok spots the people who opted in and delivers each photo to the people in it. Anyone who said no stays blurred or untagged."],
  ["The night, as a timeline", "Photos are grouped into moments by time and place, ready to replay on the big screen at the end."],
  ["Post together", "Grok picks who posts which photo and when, then lines up replies, upvotes and reposts so every post lands."],
  ["Keep score", "Points for photos, posts, replies and upvotes. The top three win community merch."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Wordmark className="text-3xl" />
        <span className="eyebrow hidden sm:inline">Weird Stuff track · Grok Bot Hackathon London</span>
      </div>
      <section className="mt-10 grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="eyebrow">For London&apos;s hackathon &amp; meetup communities</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Every photo from tonight, <span className="text-glow-deep">found, consented and shared together.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            After every event the photos sit in dozens of camera rolls. Nobody is tagged, people who asked not to be posted get posted anyway, and the few posts that go out die alone. afterglow fixes the night after.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/join/${EVENT_ID}`} className="btn-grok px-6 py-3.5 text-base">
              Join tonight
            </Link>
            <Link href={`/organiser/${EVENT_ID}`} className="btn-primary px-6 py-3.5 text-base">
              Organiser dashboard
            </Link>
            <Link href={`/organiser/${EVENT_ID}/timeline`} className="btn-ghost px-6 py-3.5 text-base">
              ▶ Play the timeline
            </Link>
          </div>
        </div>
        <div className="relative grid place-items-center rounded-[2.5rem] bg-gradient-to-br from-[#6cc8ff] to-[#3fb3fa] p-10">
          <Mascot className="w-full max-w-md" />
        </div>
      </section>
      <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

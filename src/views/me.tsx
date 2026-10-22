"use client";

import Link from "next/link";
import { photoSrc, useAppData } from "@/lib/client";
import { leaderboard } from "@/lib/points";
import { AppShell, Loading } from "@/components/nav";
import { TaskCard } from "@/components/task-card";
import { Badge, LinkedInIcon, Mascot, XIcon } from "@/components/ui";

export function MeView({ eventId }: { eventId: string }) {
  const state = useAppData(5000);
  if (!state) return <AppShell eventId={eventId} tab="grok" state={state}><Loading /></AppShell>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const me = people.find((a) => a.id === state.meId);
  if (!me)
    return (
      <AppShell eventId={eventId} tab="grok" state={state}>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <Mascot pose="wave" className="w-48" />
          <p className="text-muted">Join the event and Grok will plan your posts.</p>
          <Link href={`/join/${eventId}`} className="btn-primary">Join tonight</Link>
        </div>
      </AppShell>
    );
  const mine = db.photos.filter((p) => p.eventId === eventId && p.tags.some((t) => t.attendeeId === me.id));
  const friends = [...new Set(mine.flatMap((p) => p.tags.map((t) => t.attendeeId)).filter((id) => id !== me.id))]
    .map((id) => people.find((a) => a.id === id)!)
    .slice(0, 4);
  const tasks = db.tasks.filter((t) => t.attendeeId === me.id).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const board = leaderboard(db, eventId);
  const rank = board.findIndex((s) => s.attendeeId === me.id) + 1;
  const score = board.find((s) => s.attendeeId === me.id);
  const recap = `Tonight at ${event.name}${friends.length ? ` with ${friends.map((f) => "@" + f.xHandle).join(" ")}` : ""}: ${mine.length} photos, great people and a lot of shipping. ${event.hashtag}`;
  return (
    <AppShell eventId={eventId} tab="grok" state={state}>
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-3xl bg-sky p-5 pr-32">
          <p className="eyebrow text-navy/70">Grok · your plan</p>
          <p className="mt-1 text-2xl font-extrabold leading-tight text-navy">Hey {me.name.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-navy/80">
            #{rank} on the board · {score?.points ?? 0} pts
          </p>
          <Mascot pose="walk" className="absolute -bottom-2 -right-2 w-36" />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
          <span className="inline-flex items-center gap-1 text-ink"><XIcon className="h-3 w-3" />@{me.xHandle}</span>
          {me.linkedin && <span className="inline-flex items-center gap-1 text-ink"><LinkedInIcon className="h-3 w-3" />{me.linkedin}</span>}
          <Badge tone={me.consentPhoto ? "green" : "red"}>{me.consentPhoto ? "Photos OK" : "No photos"}</Badge>
          <Badge tone={me.consentTag ? "green" : "red"}>{me.consentTag ? "Tagging on" : "No tagging"}</Badge>
          <Link href={`/join/${eventId}`} className="font-semibold text-sky">Edit</Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Your share tasks</h2>
          {tasks.length ? (
            tasks.map((t) => {
              const photo = db.photos.find((p) => p.id === t.photoId);
              return <TaskCard key={t.id} task={t} people={people} photo={photo} photoUrl={photo && photoSrc(photo, db)} target={db.tasks.find((x) => x.id === t.targetTaskId)} />;
            })
          ) : (
            <p className="card p-4 text-sm text-muted">No tasks yet. Grok assigns them when the organiser generates tonight&apos;s sharing plan.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Your recap, drafted by Grok</h2>
          <div className="card space-y-3 p-4">
            {mine.length > 0 && (
              <div className="flex gap-1.5">
                {mine.slice(0, 4).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={photoSrc(p, db)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ))}
              </div>
            )}
            <p className="rounded-2xl bg-ice px-3.5 py-2.5 text-sm text-ink">{recap}</p>
            <div className="flex gap-2">
              <a className="btn-primary flex-1 py-2 text-xs" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(recap)}`}>
                <XIcon className="h-3.5 w-3.5" /> Post on X
              </a>
              <a className="btn-ghost flex-1 py-2 text-xs" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(recap)}`}>
                <LinkedInIcon className="h-3.5 w-3.5" /> Share on LinkedIn
              </a>
            </div>
          </div>
        </section>

        <Link href={`/e/${eventId}/plan`} className="card flex items-center justify-between p-4 text-sm font-semibold">
          See tonight&apos;s full sharing plan <span className="text-lg">›</span>
        </Link>
      </div>
    </AppShell>
  );
}

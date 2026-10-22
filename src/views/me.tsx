"use client";

import Link from "next/link";
import { photoSrc, useAppData } from "@/lib/client";
import { leaderboard } from "@/lib/points";
import { Loading, Nav } from "@/components/nav";
import { PhotoCard } from "@/components/photo-card";
import { TaskCard } from "@/components/task-card";
import { Avatar, Badge, LinkedInIcon, XIcon } from "@/components/ui";

export function MeView({ eventId }: { eventId: string }) {
  const state = useAppData(5000);
  if (!state) return <><Nav eventId={eventId} active="me" state={state} /><Loading /></>;
  const { db } = state;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const me = people.find((a) => a.id === state.meId);
  if (!me)
    return (
      <>
        <Nav eventId={eventId} active="me" state={state} />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-zinc-400">Sign in to see your photos.</p>
          <Link href={`/join/${eventId}`} className="btn-grok mt-4">
            Join the event
          </Link>
        </main>
      </>
    );
  const mine = db.photos.filter((p) => p.eventId === eventId && p.tags.some((t) => t.attendeeId === me.id));
  const plan = db.plans[eventId];
  // Tasks only reach attendees once the lead has approved the plan.
  const tasks = db.tasks.filter((t) => t.attendeeId === me.id && plan?.approved).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const board = leaderboard(db, eventId);
  const rank = board.findIndex((s) => s.attendeeId === me.id) + 1;
  const score = board.find((s) => s.attendeeId === me.id);
  return (
    <>
      <Nav eventId={eventId} active="me" state={state} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="card flex flex-wrap items-center gap-4 p-5">
          <Avatar a={me} size={56} />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Hey {me.name.split(" ")[0]} 👋</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-1"><XIcon className="h-3 w-3" />@{me.xHandle}</span>
              {me.linkedin && <span className="inline-flex items-center gap-1"><LinkedInIcon className="h-3 w-3" />{me.linkedin}</span>}
              <Badge tone={me.consentPhoto ? "green" : "red"}>{me.consentPhoto ? "Photos OK" : "No photos"}</Badge>
              <Badge tone={me.consentTag ? "green" : "red"}>{me.consentTag ? "Tagging on" : "No tagging"}</Badge>
              <Link href={`/join/${eventId}`} className="text-fuchsia-300 hover:underline">edit consent</Link>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black">#{rank}</p>
            <p className="text-sm text-zinc-400">{score?.points ?? 0} pts</p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Your share tasks <span className="text-sm font-normal text-zinc-500">· from Grokbot</span></h2>
          {tasks.length ? (
            <div className="space-y-3">
              {tasks.map((t) => {
                const photo = db.photos.find((p) => p.id === t.photoId);
                return <TaskCard key={t.id} task={t} people={people} photo={photo} photoUrl={photo && photoSrc(photo, db)} target={db.tasks.find((x) => x.id === t.targetTaskId)} />;
              })}
            </div>
          ) : (
            <p className="card p-4 text-sm text-zinc-400">
              {plan && !plan.approved ? "Grokbot has drafted the sharing plan. Your tasks appear here as soon as the organiser approves it." : "No tasks yet. Grokbot will assign some once the organiser generates the sharing plan."}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Photos you&apos;re in <span className="text-sm font-normal text-zinc-500">· delivered by Grok ({mine.length})</span></h2>
          {mine.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((p) => (
                <PhotoCard key={p.id} photo={p} src={photoSrc(p, db)} people={people} highlight={me.id} />
              ))}
            </div>
          ) : (
            <p className="card p-4 text-sm text-zinc-400">{me.consentTag ? "No photos of you yet. Check back after the next upload." : "You opted out of tagging, so Grok won't match you in photos."}</p>
          )}
        </section>
      </main>
    </>
  );
}

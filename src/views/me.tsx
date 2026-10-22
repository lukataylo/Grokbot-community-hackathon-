"use client";

import { useState } from "react";
import Link from "next/link";
import { api, photoSrc, useAppData } from "@/lib/client";
import { leaderboard } from "@/lib/points";
import { Loading } from "@/components/nav";
import { AppShell } from "@/components/app-shell";
import { TaskCard } from "@/components/task-card";
import { Badge, LinkedInIcon, Mascot, SparkleIcon, XIcon } from "@/components/ui";

export function MeView({ eventId }: { eventId: string }) {
  const state = useAppData(5000);
  const [recap, setRecap] = useState<{ x: string; linkedin: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state) return <AppShell eventId={eventId} state={state} title="Your Grok"><Loading /></AppShell>;
  const { db } = state;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const me = people.find((a) => a.id === state.meId);
  if (!me)
    return (
      <AppShell eventId={eventId} state={state} title="Your Grok">
        <div className="card flex flex-col items-center p-8 text-center">
          <Mascot pose="wave" className="w-36" />
          <p className="mt-4 font-semibold">Join to meet your Grok</p>
          <p className="mt-1 text-sm text-muted">It finds your photos, tells you what to post and drafts your recap.</p>
        </div>
      </AppShell>
    );
  const plan = db.plans[eventId];
  // Tasks only reach attendees once the lead has approved the plan.
  const tasks = db.tasks.filter((t) => t.attendeeId === me.id && plan?.approved).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const open = tasks.filter((t) => t.status === "todo");
  const board = leaderboard(db, eventId);
  const rank = board.findIndex((s) => s.attendeeId === me.id) + 1;
  const score = board.find((s) => s.attendeeId === me.id);
  const mine = db.photos.filter((p) => p.eventId === eventId && p.tags.some((t) => t.attendeeId === me.id));
  return (
    <AppShell eventId={eventId} state={state} title={`Hey ${me.name.split(" ")[0]}`}>
      <div className="card mb-4 flex items-center gap-4 p-4">
        <div className="flex-1">
          <p className="text-sm text-muted">You&apos;re ranked</p>
          <p className="text-3xl font-extrabold tracking-tight">#{rank} <span className="text-base font-medium text-muted">· {score?.points ?? 0} pts</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={me.consentPhoto ? "green" : "red"}>{me.consentPhoto ? "Photos OK" : "No photos"}</Badge>
            <Badge tone={me.consentTag ? "green" : "red"}>{me.consentTag ? "Tagging on" : "No tagging"}</Badge>
          </div>
        </div>
        <Link href={`/e/${eventId}`} className="text-center">
          <span className="block text-3xl font-extrabold">{mine.length}</span>
          <span className="text-xs text-muted">photos of you</span>
        </Link>
      </div>

      <section className="card mb-4 overflow-hidden">
        <div className="flex items-center gap-3 bg-gradient-to-br from-[#6cc8ff] to-[#3fb3fa] px-4 py-3">
          <Mascot pose="wave" className="w-14" />
          <div className="flex-1">
            <p className="font-bold text-navy">Draft a recap with Grok</p>
            <p className="text-xs text-navy/75">From the {mine.length} photos you&apos;re tagged in. Only people who opted in are mentioned.</p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {recap ? (
            <>
              {(["x", "linkedin"] as const).map((p) => (
                <div key={p}>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                    {p === "x" ? <XIcon className="h-3.5 w-3.5" /> : <LinkedInIcon className="h-3.5 w-3.5" />} {p === "x" ? "X" : "LinkedIn"}
                  </p>
                  <textarea className="input h-28 text-sm" value={recap[p]} onChange={(e) => setRecap({ ...recap, [p]: e.target.value })} />
                  <a
                    className="btn-primary mt-2 w-full"
                    target="_blank"
                    rel="noreferrer"
                    href={p === "x" ? `https://x.com/intent/post?text=${encodeURIComponent(recap.x)}` : `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(recap.linkedin)}`}
                  >
                    Post on {p === "x" ? "X" : "LinkedIn"}
                  </a>
                </div>
              ))}
            </>
          ) : (
            <button
              className="btn-grok w-full py-3"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setRecap(await api.recap(eventId));
                setBusy(false);
              }}
            >
              <SparkleIcon className="h-5 w-5" /> {busy ? "Grok is writing…" : "Write my recap"}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-bold">
          Your share tasks {open.length > 0 && <span className="text-sm font-medium text-muted">· {open.length} to do</span>}
        </h2>
        {tasks.length ? (
          <div className="space-y-3">
            {tasks.map((t) => {
              const photo = db.photos.find((p) => p.id === t.photoId);
              return <TaskCard key={t.id} task={t} people={people} photo={photo} photoUrl={photo && photoSrc(photo, db)} target={db.tasks.find((x) => x.id === t.targetTaskId)} />;
            })}
          </div>
        ) : (
          <p className="card p-4 text-sm text-muted">
            {plan && !plan.approved ? "Grok has drafted the sharing plan. Your tasks appear here as soon as the organiser approves it." : "No tasks yet. Grok assigns them once the organiser publishes the sharing plan."}
          </p>
        )}
      </section>
    </AppShell>
  );
}

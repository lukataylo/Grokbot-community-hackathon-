"use client";

import { api, photoSrc, useAppData } from "@/lib/client";
import { Loading, OrganiserBar } from "@/components/nav";
import { TaskCard } from "@/components/task-card";
import { ActionButton } from "@/components/actions";
import { Mascot, SparkleIcon, relTime } from "@/components/ui";

export function PlanView({ eventId }: { eventId: string }) {
  const state = useAppData(5000);
  if (!state) return <><OrganiserBar eventId={eventId} state={state} /><Loading /></>;
  const { db } = state;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const plan = db.plans[eventId];
  const tasks = db.tasks.filter((t) => t.eventId === eventId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const anchors = tasks.filter((t) => t.type === "post");
  const done = tasks.filter((t) => t.status === "done").length;
  return (
    <>
      <OrganiserBar eventId={eventId} state={state} />
      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <div className="relative overflow-hidden rounded-[32px] bg-sky p-7 pr-56">
          <p className="eyebrow text-navy/70">Grok · coordinated reach</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-navy">Sharing plan</h1>
          <p className="mt-2 max-w-xl text-navy/80">{plan ? plan.strategy : "A timed schedule of who posts, who comments and who reposts whom across X and LinkedIn."}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ActionButton run={() => api.plan(eventId)} className="btn-primary" label={<><SparkleIcon className="h-4 w-4" /> {plan ? "Regenerate plan" : "Generate plan with Grok"}</>} busyLabel="Grok is planning…" />
            {plan && (
              <span className="text-sm font-medium text-navy/80">
                {done}/{tasks.length} done · generated {relTime(plan.generatedAt)} · copy by {plan.source === "grok" ? "Grok" : "templates (mock)"}
              </span>
            )}
          </div>
          <Mascot pose="wave" className="absolute -bottom-4 right-4 w-52" />
        </div>
        {!tasks.length && <p className="card p-6 text-center text-muted">No plan yet. Tag some photos, then generate.</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          {anchors.map((anchor, i) => {
            const wave = tasks.filter((t) => t.targetTaskId === anchor.id);
            const photo = db.photos.find((p) => p.id === anchor.photoId);
            return (
              <section key={anchor.id} className="space-y-2">
                <h2 className="eyebrow text-sky">{anchor.photoId ? `Wave ${i + 1}` : "Recap"}</h2>
                <TaskCard task={anchor} people={people} photo={photo} photoUrl={photo && photoSrc(photo, db)} />
                <div className="ml-5 space-y-2 border-l-2 border-sky-soft pl-4">
                  {wave.map((t) => (
                    <TaskCard key={t.id} task={t} people={people} target={anchor} compact />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}

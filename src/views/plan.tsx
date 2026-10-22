"use client";

import { api, photoSrc, useAppData } from "@/lib/client";
import { Loading, Nav } from "@/components/nav";
import { TaskCard } from "@/components/task-card";
import { ActionButton } from "@/components/actions";
import { Badge, SparkleIcon, relTime } from "@/components/ui";

export function PlanView({ eventId }: { eventId: string }) {
  const state = useAppData(5000);
  if (!state) return <><Nav eventId={eventId} active="plan" state={state} /><Loading /></>;
  const { db } = state;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const plan = db.plans[eventId];
  const tasks = db.tasks.filter((t) => t.eventId === eventId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const anchors = tasks.filter((t) => t.type === "post");
  const done = tasks.filter((t) => t.status === "done").length;
  return (
    <>
      <Nav eventId={eventId} active="plan" state={state} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Sharing plan</h1>
            <p className="text-muted">A timed schedule of who posts, who comments and who reposts whom.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {plan && !plan.approved && <ActionButton run={() => api.approvePlan(eventId)} label="✓ Approve & send to attendees" busyLabel="Approving…" />}
            <ActionButton run={() => api.plan(eventId)} label={<><SparkleIcon className="h-4 w-4" /> {plan ? "Regenerate plan" : "Generate plan with Grok"}</>} busyLabel="Grok is planning…" className={plan && !plan.approved ? "btn-ghost" : "btn-grok"} />
          </div>
        </div>
        {plan && (
          <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <Badge tone={plan.approved ? "green" : "amber"}>{plan.approved ? "Approved" : "Draft · attendees can't see this yet"}</Badge>
            <Badge tone="fuchsia">Strategy</Badge>
            <p className="flex-1 text-navy/80">{plan.strategy}</p>
            <span className="text-xs text-muted">
              {done}/{tasks.length} done · generated {relTime(plan.generatedAt)} · copy by {plan.source === "grok" ? "Grok" : "templates (mock)"}
            </span>
          </div>
        )}
        {!tasks.length && <p className="card p-6 text-center text-muted">No plan yet. Tag some photos, then generate.</p>}
        <div className="space-y-8">
          {anchors.map((anchor, i) => {
            const wave = tasks.filter((t) => t.targetTaskId === anchor.id);
            const photo = db.photos.find((p) => p.id === anchor.photoId);
            return (
              <section key={anchor.id}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-glow-deep">{anchor.photoId ? `Wave ${i + 1}` : "Recap"}</h2>
                <TaskCard task={anchor} people={people} photo={photo} photoUrl={photo && photoSrc(photo, db)} />
                <div className="ml-6 mt-2 space-y-2 border-l border-line pl-4">
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

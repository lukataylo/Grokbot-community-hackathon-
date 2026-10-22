import { readDB } from "@/lib/store";
import { Nav } from "@/components/nav";
import { TaskCard } from "@/components/task-card";
import { ActionButton } from "@/components/actions";
import { Badge, GrokMark, relTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const db = readDB();
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const plan = db.plans[eventId];
  const tasks = db.tasks.filter((t) => t.eventId === eventId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const anchors = tasks.filter((t) => t.type === "post");
  const done = tasks.filter((t) => t.status === "done").length;
  return (
    <>
      <Nav eventId={eventId} active="plan" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Sharing plan</h1>
            <p className="text-zinc-400">A timed schedule of who posts, who comments and who reposts whom.</p>
          </div>
          <ActionButton url="/api/plan" body={{ eventId }} label={<><GrokMark className="h-4 w-4" /> {plan ? "Regenerate plan" : "Generate plan with Grok"}</>} busyLabel="Grok is planning…" />
        </div>
        {plan && (
          <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <Badge tone="fuchsia">Strategy</Badge>
            <p className="flex-1 text-zinc-300">{plan.strategy}</p>
            <span className="text-xs text-zinc-500">
              {done}/{tasks.length} done · generated {relTime(plan.generatedAt)} · copy by {plan.source === "grok" ? "Grok" : "templates (mock)"}
            </span>
          </div>
        )}
        {!tasks.length && <p className="card p-6 text-center text-zinc-400">No plan yet. Tag some photos, then generate.</p>}
        <div className="space-y-8">
          {anchors.map((anchor, i) => {
            const wave = tasks.filter((t) => t.targetTaskId === anchor.id);
            return (
              <section key={anchor.id}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fuchsia-300">
                  {anchor.photoId ? `Wave ${i + 1}` : "Recap"}
                </h2>
                <TaskCard task={anchor} people={people} photo={db.photos.find((p) => p.id === anchor.photoId)} />
                <div className="ml-6 mt-2 space-y-2 border-l border-white/10 pl-4">
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

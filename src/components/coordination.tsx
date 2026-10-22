"use client";

import Link from "next/link";
import { api, photoSrc } from "@/lib/client";
import type { DB } from "@/lib/types";
import { ActionButton } from "./actions";
import { Avatar, PlatformIcon, SparkleIcon, fmtTime } from "./ui";

function Meter({ label, done, total }: { label: string; done: number; total: number }) {
  if (!total) return null;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="font-semibold text-navy">
          {done}/{total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist">
        <div className="h-full rounded-full bg-glow transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** Live view of every wave: is the anchor post live, and how many replies, upvotes and reposts have landed. */
export function Coordination({ db, eventId }: { db: DB; eventId: string }) {
  const plan = db.plans[eventId];
  const tasks = db.tasks.filter((t) => t.eventId === eventId);
  const anchors = tasks.filter((t) => t.type === "post" && t.photoId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const who = (id: string) => db.attendees.find((a) => a.id === id)!;
  const tagged = db.photos.filter((p) => p.eventId === eventId && p.status === "tagged").length;
  return (
    <div className="card flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-bold">Coordinated sharing</h3>
        {plan && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${plan.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{plan.approved ? "Live" : "Draft"}</span>}
      </div>
      {!plan ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3">
          <p className="text-sm text-muted">Grok picks the best photo for each wave, who should post it (highest reach in the photo), and who replies, upvotes and reposts, staggered so posts don&apos;t compete.</p>
          <ActionButton run={() => api.plan(eventId)} label={<><SparkleIcon className="h-4 w-4" /> Plan the sharing{tagged ? "" : " (tag photos first)"}</>} busyLabel="Grok is planning…" />
        </div>
      ) : (
        <>
          {!plan.approved && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm">
              <span className="flex-1 text-amber-800">{tasks.length} tasks drafted. Attendees see nothing until you approve.</span>
              <ActionButton run={() => api.approvePlan(eventId)} label="Approve & send" className="btn-primary px-4 py-2 text-xs" busyLabel="Sending…" />
            </div>
          )}
          <ul className="space-y-3">
            {anchors.map((a, i) => {
              const wave = tasks.filter((t) => t.targetTaskId === a.id);
              const n = (type: string, done?: boolean) => wave.filter((t) => t.type === type && (!done || t.status === "done")).length;
              const photo = db.photos.find((p) => p.id === a.photoId);
              const poster = who(a.attendeeId);
              return (
                <li key={a.id} className="flex items-center gap-3">
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoSrc(photo, db)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-semibold text-muted">Wave {i + 1}</span>
                      <Avatar a={poster} size={18} />
                      <span className="truncate font-semibold">@{poster.xHandle}</span>
                      <PlatformIcon p={a.platform} className="h-3 w-3 text-muted" />
                      <span className={`ml-auto shrink-0 text-xs font-semibold ${a.status === "done" ? "text-emerald-600" : "text-muted"}`}>{a.status === "done" ? "● Live" : fmtTime(a.scheduledAt)}</span>
                    </div>
                    <div className="flex gap-3">
                      <Meter label="Upvotes" done={n("like", true)} total={n("like")} />
                      <Meter label="Replies" done={n("comment", true)} total={n("comment")} />
                      <Meter label="Reposts" done={n("repost", true)} total={n("repost")} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href={`/e/${eventId}/plan`} className="mt-4 text-sm font-semibold text-glow-deep hover:underline">Open the full plan →</Link>
        </>
      )}
    </div>
  );
}

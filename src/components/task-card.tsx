import type { Attendee, Photo, ShareTask } from "@/lib/types";
import { POINTS } from "@/lib/points";
import { api } from "@/lib/client";
import { ActionButton } from "./actions";
import { Avatar, Badge, PlatformIcon, fmtTime, relTime } from "./ui";

const VERB = { post: "Post", comment: "Comment on", repost: "Repost" } as const;

function intentUrl(t: ShareTask) {
  const text = encodeURIComponent(t.copy);
  return t.platform === "x" ? `https://x.com/intent/post?text=${text}` : `https://www.linkedin.com/feed/?shareActive=true&text=${text}`;
}

export function TaskCard({ task, people, photo, photoUrl, target, compact }: { task: ShareTask; people: Attendee[]; photo?: Photo; photoUrl?: string; target?: ShareTask; compact?: boolean }) {
  const a = people.find((p) => p.id === task.attendeeId)!;
  const targetWho = target && people.find((p) => p.id === target.attendeeId);
  const due = new Date(task.scheduledAt).getTime() <= Date.now() + 60000;
  const done = task.status === "done";
  return (
    <div className={`card flex gap-3 p-3 ${done ? "opacity-60" : due ? "ring-1 ring-2 ring-glow" : ""}`}>
      {photo && !compact && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-20 w-24 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Avatar a={a} size={22} />
          <span className="font-semibold">@{a.xHandle}</span>
          <span className="text-muted">
            {VERB[task.type]} {targetWho ? `@${targetWho.xHandle}'s post` : "a photo"}
          </span>
          <Badge tone={task.platform === "x" ? "zinc" : "sky"}>
            <PlatformIcon p={task.platform} className="h-3 w-3" />
            {task.platform === "x" ? "X" : "LinkedIn"}
          </Badge>
          <Badge tone="green">+{POINTS[task.type]} pts</Badge>
          <span className="ml-auto text-xs text-muted">
            {fmtTime(task.scheduledAt)} · {done ? "done ✓" : relTime(task.scheduledAt)}
          </span>
        </div>
        <p className="rounded-lg bg-mist px-3 py-2 text-sm text-navy">{task.copy}</p>
        {!compact && <p className="text-xs text-muted">💡 {task.why}</p>}
        {!done && (
          <div className="flex gap-2 pt-1">
            <a href={intentUrl(task)} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1 text-xs">
              Open {task.platform === "x" ? "X" : "LinkedIn"}
            </a>
            <ActionButton run={() => api.completeTask(task.id)} label="Mark done" className="btn-primary px-3 py-1 text-xs" busyLabel="Saving" />
          </div>
        )}
      </div>
    </div>
  );
}

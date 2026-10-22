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
    <div className={`card space-y-2.5 p-4 ${done ? "opacity-60" : due ? "ring-2 ring-sky" : ""}`}>
      <div className="flex items-center gap-2.5">
        {photo && !compact ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <Avatar a={a} size={32} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            @{a.xHandle} <span className="font-medium text-muted">· {VERB[task.type]} {targetWho ? `@${targetWho.xHandle}'s post` : "a photo"}</span>
          </p>
          <p className="text-xs text-muted">
            {fmtTime(task.scheduledAt)} · {done ? "done ✓" : relTime(task.scheduledAt)}
          </p>
        </div>
        <Badge tone={task.platform === "x" ? "zinc" : "sky"}>
          <PlatformIcon p={task.platform} className="h-3 w-3" />
          {task.platform === "x" ? "X" : "LinkedIn"}
        </Badge>
      </div>
      <p className="rounded-2xl bg-ice px-3.5 py-2.5 text-sm text-ink">{task.copy}</p>
      {!compact && <p className="text-xs text-muted">✨ {task.why}</p>}
      <div className="flex items-center gap-2">
        <Badge tone="green">+{POINTS[task.type]} pts</Badge>
        {!done && (
          <div className="ml-auto flex gap-2">
            <a href={intentUrl(task)} target="_blank" rel="noreferrer" className="btn-ghost px-3.5 py-1.5 text-xs">
              Open {task.platform === "x" ? "X" : "LinkedIn"}
            </a>
            <ActionButton run={() => api.completeTask(task.id)} label="Mark done" className="btn-primary px-3.5 py-1.5 text-xs" busyLabel="Saving" />
          </div>
        )}
      </div>
    </div>
  );
}

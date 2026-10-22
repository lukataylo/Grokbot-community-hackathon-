"use client";

import { useState } from "react";
import type { Attendee, Photo, ShareTask } from "@/lib/types";
import { POINTS } from "@/lib/points";
import { api } from "@/lib/client";
import { ActionButton } from "./actions";
import { Avatar, CheckIcon, ExternalIcon, PlatformIcon, fmtTime, relTime } from "./ui";

const VERB = { post: "Post this photo", comment: "Reply to", repost: "Repost", like: "Upvote" } as const;
const DONE = { post: "Posted", comment: "Replied", repost: "Reposted", like: "Upvoted" } as const;

function intentUrl(t: ShareTask) {
  const text = encodeURIComponent(t.copy);
  return t.platform === "x" ? `https://x.com/intent/post?text=${text}` : `https://www.linkedin.com/feed/?shareActive=true&text=${text}`;
}

/** The live post: the link the poster shared, or their latest posts as a fallback. */
export function postLink(anchor: ShareTask, poster?: Attendee) {
  if (anchor.postUrl) return anchor.postUrl;
  if (!poster) return "#";
  return anchor.platform === "x" ? `https://x.com/search?q=${encodeURIComponent(`from:${poster.xHandle}`)}&f=live` : `https://www.linkedin.com/in/${poster.linkedin}/recent-activity/all/`;
}

export function TaskCard({ task, people, photo, photoUrl, target, compact, hero }: { task: ShareTask; people: Attendee[]; photo?: Photo; photoUrl?: string; target?: ShareTask; compact?: boolean; hero?: boolean }) {
  const a = people.find((p) => p.id === task.attendeeId)!;
  const poster = target && people.find((p) => p.id === target.attendeeId);
  const done = task.status === "done";
  const locked = !!target && target.status !== "done";
  const [posting, setPosting] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const platform = task.platform === "x" ? "X" : "LinkedIn";
  const what = poster ? `${VERB[task.type]} @${poster.xHandle}'s post` : VERB[task.type];
  return (
    <div className={`card overflow-hidden ${hero ? "ring-2 ring-glow" : ""} ${done ? "opacity-70" : ""}`}>
      <div className="flex gap-3 p-4">
        {photo && !compact && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className={`shrink-0 rounded-2xl object-cover ${hero ? "h-24 w-24" : "h-16 w-16"}`} />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {compact && <Avatar a={a} size={22} />}
            {compact && <span className="font-semibold">@{a.xHandle}</span>}
            <span className={compact ? "text-muted" : "font-semibold"}>{what}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 font-medium text-navy">
              <PlatformIcon p={task.platform} className="h-3 w-3" /> {platform}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">+{POINTS[task.type]} pts</span>
            <span>{done ? `${DONE[task.type]} ${relTime(task.doneAt!)}` : `${fmtTime(task.scheduledAt)} · ${relTime(task.scheduledAt)}`}</span>
          </div>
        </div>
        {done && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
            <CheckIcon className="h-4 w-4" />
          </span>
        )}
      </div>

      {!done && task.copy && (
        <p className="mx-4 rounded-2xl bg-mist px-4 py-3 text-sm leading-relaxed">{task.copy}</p>
      )}
      {!done && !compact && <p className="mx-4 mt-2 text-xs text-muted">💡 {task.why}</p>}

      {!done && (
        <div className="p-4 pt-3">
          {locked ? (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
              🔒 Unlocks when @{poster?.xHandle} posts · due {fmtTime(target!.scheduledAt)}
            </p>
          ) : task.type === "post" ? (
            posting ? (
              <div className="space-y-2">
                <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`Paste your ${platform} post link (optional)`} />
                <p className="text-xs text-muted">The link goes to everyone lined up to reply and upvote, so they land on the right post.</p>
                <div className="flex gap-2">
                  <ActionButton run={() => api.completeTask(task.id, url)} label="Confirm, it's live" className="btn-primary flex-1" busyLabel="Saving" />
                  <button className="btn-ghost" onClick={() => setPosting(false)}>Back</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <a href={intentUrl(task)} target="_blank" rel="noreferrer" className="btn-grok flex-1">
                  Post on {platform} <ExternalIcon className="h-4 w-4" />
                </a>
                <button className="btn-ghost" onClick={() => setPosting(true)}>I&apos;ve posted</button>
              </div>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {target && (
                <a
                  href={postLink(target, poster)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-grok flex-1"
                  onClick={() => {
                    if (task.copy) navigator.clipboard?.writeText(task.copy).then(() => setCopied(true)).catch(() => {});
                  }}
                >
                  Open the post <ExternalIcon className="h-4 w-4" />
                </a>
              )}
              <ActionButton run={() => api.completeTask(task.id)} label={`Mark ${DONE[task.type].toLowerCase()}`} className="btn-primary" busyLabel="Saving" />
              {copied && <p className="w-full text-xs text-emerald-700">Reply copied. Paste it under the post.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

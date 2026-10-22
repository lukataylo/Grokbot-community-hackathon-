"use client";

import { useState } from "react";
import { useAppData } from "@/lib/client";
import { leaderboard, POINTS, type Score } from "@/lib/points";
import { Loading } from "@/components/nav";
import { AppShell } from "@/components/app-shell";
import { Avatar, ChartIcon, ExternalIcon, Mascot } from "@/components/ui";
import type { DB } from "@/lib/types";

/** Points summed across every event, matched by X handle. */
function allTime(db: DB) {
  const byHandle = new Map<string, Score>();
  for (const e of db.events)
    for (const s of leaderboard(db, e.id)) {
      const a = db.attendees.find((x) => x.id === s.attendeeId)!;
      const k = a.xHandle.toLowerCase();
      const cur = byHandle.get(k);
      if (cur) cur.points += s.points;
      else byHandle.set(k, { ...s });
    }
  return [...byHandle.values()].sort((a, b) => b.points - a.points);
}

export function LeaderboardView({ eventId }: { eventId: string }) {
  const state = useAppData(3000);
  const [tab, setTab] = useState<"tonight" | "all">("tonight");
  const [guide, setGuide] = useState(false);
  if (!state) return <AppShell eventId={eventId} state={state} title="Leaderboard"><Loading /></AppShell>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const board = tab === "tonight" ? leaderboard(db, eventId) : allTime(db);
  const who = (id: string) => db.attendees.find((a) => a.id === id)!;
  const short = (name: string) => {
    const [f, l] = name.split(" ");
    return l ? `${f} ${l[0]}.` : f;
  };
  return (
    <AppShell eventId={eventId} state={state} title="Leaderboard">
      <div className="relative mb-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#6cc8ff] to-[#3fb3fa] p-5 pr-32">
        <p className="text-xl font-extrabold tracking-tight text-navy">Community merch</p>
        <p className="mt-1 text-sm text-navy/75">Tonight&apos;s top 3 contributors win {event.prizes.map((p) => p.prize.split(" + ")[0]).join(", ")}.</p>
        <Mascot pose="walk" className="absolute -right-2 bottom-1 w-32 rotate-6" />
      </div>
      <div className="seg mb-3">
        <button className={`seg-item ${tab === "tonight" ? "seg-on" : ""}`} onClick={() => setTab("tonight")}>Tonight</button>
        <button className={`seg-item ${tab === "all" ? "seg-on" : ""}`} onClick={() => setTab("all")}>All time</button>
      </div>
      <p className="eyebrow mb-1 pr-4 text-right">Points</p>
      <ol>
        {board.map((s, i) => {
          const a = who(s.attendeeId);
          const isMe = a.id === state.meId;
          return (
            <li key={s.attendeeId} className={`flex items-center gap-4 border-b border-line px-3 py-3 last:border-0 ${isMe ? "rounded-2xl border-transparent bg-glow-soft" : ""}`}>
              <span className={`w-5 text-lg font-semibold ${i === 0 ? "text-glow-deep" : "text-navy"}`}>{i + 1}</span>
              <Avatar a={a} size={44} />
              <span className="flex-1 font-semibold">
                {short(a.name)}
                {isMe && " (you)"}
                {i < 3 && tab === "tonight" && <span className="ml-1">{["🥇", "🥈", "🥉"][i]}</span>}
              </span>
              <span className="text-lg font-medium tabular-nums">{s.points}</span>
            </li>
          );
        })}
      </ol>
      <div className="card mt-4 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <ChartIcon className="h-5 w-5" />
          <span className="flex-1">Photos, posts, replies &amp; upvotes</span>
          <button className="inline-flex items-center gap-1 font-semibold text-glow-deep" onClick={() => setGuide(!guide)}>
            Points guide <ExternalIcon className="h-4 w-4" />
          </button>
        </div>
        {guide && (
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {[
              ["Upload a photo", POINTS.upload],
              ["Tagged in a photo", POINTS.tagged],
              ["Post", POINTS.post],
              ["Repost", POINTS.repost],
              ["Helpful reply", POINTS.comment],
              ["Early upvote", POINTS.like],
            ].map(([l, p]) => (
              <li key={l} className="flex justify-between rounded-xl bg-mist px-3 py-2">
                <span>{l}</span>
                <span className="font-semibold">+{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

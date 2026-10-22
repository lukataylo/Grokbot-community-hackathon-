"use client";

import { useState } from "react";
import { useAppData } from "@/lib/client";
import { leaderboard, POINTS } from "@/lib/points";
import { AppShell, Loading } from "@/components/nav";
import { Avatar, Mascot, Segmented } from "@/components/ui";

export function LeaderboardView({ eventId }: { eventId: string }) {
  const state = useAppData(3000);
  const [range, setRange] = useState<"tonight" | "all">("tonight");
  const [guide, setGuide] = useState(false);
  if (!state) return <AppShell eventId={eventId} tab="leaderboard" state={state}><Loading /></AppShell>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const board = leaderboard(db, eventId);
  const who = (id: string) => db.attendees.find((a) => a.id === id)!;
  const shortName = (name: string) => {
    const [first, last] = name.split(" ");
    return last ? `${first} ${last[0]}.` : first;
  };
  return (
    <AppShell eventId={eventId} tab="leaderboard" state={state}>
      <div className="space-y-4">
        <div>
          <p className="eyebrow">{event.shortName ?? event.name}</p>
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Leaderboard</h1>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-sky p-5 pr-36">
          <p className="text-xl font-extrabold text-navy">Community merch</p>
          <p className="mt-0.5 text-sm text-navy/80">Tonight&apos;s top 3 contributors.</p>
          <Mascot pose="wave" className="absolute -bottom-3 right-0 w-36" />
        </div>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "tonight", label: "Tonight" },
            { value: "all", label: "All time" },
          ]}
        />
        <div>
          {range === "all" && <p className="px-1 pb-1 text-xs text-muted">This is the community&apos;s first afterglow event, so all-time matches tonight.</p>}
          <p className="eyebrow mb-1 text-right">Points</p>
          <ol className="space-y-1">
            {board.map((s, i) => {
              const a = who(s.attendeeId);
              const isMe = a.id === state.meId;
              return (
                <li key={s.attendeeId} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${isMe ? "bg-sky-soft" : ""}`}>
                  <span className="w-5 text-sm font-bold text-sky">{i + 1}</span>
                  <Avatar a={a} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {shortName(a.name)} {isMe && <span className="font-medium text-muted">(you)</span>}
                    </p>
                    {i < 3 && <p className="truncate text-xs text-muted">🎁 {event.prizes[i]?.prize}</p>}
                  </div>
                  <span className="font-semibold tabular-nums">{s.points}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <button onClick={() => setGuide((g) => !g)} className="card flex w-full items-center gap-3 p-3.5 text-left">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-navy" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
          <span className="flex-1 text-sm text-ink">Photos, posts & helpful replies</span>
          <span className="text-sm font-semibold text-sky">Points guide ↗</span>
        </button>
        {guide && (
          <div className="card grid grid-cols-2 gap-2 p-4 text-sm">
            {[
              ["Upload a photo", POINTS.upload],
              ["Tagged in a photo", POINTS.tagged],
              ["Post on X / LinkedIn", POINTS.post],
              ["Repost a friend", POINTS.repost],
              ["Helpful comment", POINTS.comment],
            ].map(([label, pts]) => (
              <div key={label as string} className="flex justify-between rounded-xl bg-ice px-3 py-2">
                <span className="text-ink">{label}</span>
                <span className="font-bold">+{pts}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

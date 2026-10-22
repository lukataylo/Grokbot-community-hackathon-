"use client";

import { useAppData } from "@/lib/client";
import { leaderboard, POINTS } from "@/lib/points";
import { Loading, Nav } from "@/components/nav";
import { Avatar } from "@/components/ui";

export function LeaderboardView({ eventId }: { eventId: string }) {
  const state = useAppData(3000);
  if (!state) return <><Nav eventId={eventId} active="leaderboard" state={state} /><Loading /></>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const board = leaderboard(db, eventId);
  const who = (id: string) => db.attendees.find((a) => a.id === id)!;
  return (
    <>
      <Nav eventId={eventId} active="leaderboard" state={state} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-zinc-400">
            Upload +{POINTS.upload} · Tagged in a photo +{POINTS.tagged} · Post +{POINTS.post} · Repost +{POINTS.repost} · Comment +{POINTS.comment}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {board.slice(0, 3).map((s, i) => {
            const a = who(s.attendeeId);
            return (
              <div key={s.attendeeId} className={`card relative overflow-hidden p-5 text-center ${i === 0 ? "ring-2 ring-amber-300/60" : ""}`}>
                <div className="text-4xl">{["🥇", "🥈", "🥉"][i]}</div>
                <div className="mt-2 flex justify-center"><Avatar a={a} size={56} /></div>
                <p className="mt-2 font-bold">@{a.xHandle}</p>
                <p className="text-3xl font-black">{s.points}</p>
                <p className="text-xs text-zinc-400">{event.prizes[i]?.prize}</p>
              </div>
            );
          })}
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-zinc-400">
              <tr>
                <th className="p-3">#</th><th>Attendee</th><th>Photos</th><th>Tagged</th><th>Posts</th><th>Comments</th><th>Reposts</th><th>Reach</th><th className="pr-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {board.map((s, i) => {
                const a = who(s.attendeeId);
                return (
                  <tr key={s.attendeeId} className="border-t border-white/5">
                    <td className="p-3 text-zinc-500">{i + 1}</td>
                    <td><span className="flex items-center gap-2"><Avatar a={a} size={24} />@{a.xHandle}</span></td>
                    <td>{s.uploads}</td><td>{s.tagged}</td><td>{s.posts}</td><td>{s.comments}</td><td>{s.reposts}</td>
                    <td>{s.reach.toLocaleString()}</td>
                    <td className="pr-3 text-right font-bold">{s.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

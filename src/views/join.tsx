"use client";

import { useAppData } from "@/lib/client";
import { JoinForm } from "@/components/actions";
import { Loading } from "@/components/nav";
import { GrokMark } from "@/components/ui";

export function JoinView({ eventId }: { eventId: string }) {
  const state = useAppData();
  if (!state) return <Loading />;
  const event = state.db.events.find((e) => e.id === eventId);
  if (!event) return <p className="p-10 text-center text-zinc-400">Event not found.</p>;
  const me = state.db.attendees.find((a) => a.id === state.meId && a.eventId === eventId);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-black">
            <GrokMark />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wider text-fuchsia-300">You&apos;re checking in to</p>
            <h1 className="text-lg font-bold leading-tight">{event.name}</h1>
            <p className="text-xs text-zinc-500">
              {event.venue} · {event.hashtag}
            </p>
          </div>
        </div>
        <JoinForm key={me?.id ?? "new"} eventId={eventId} initial={me} />
      </div>
      <p className="mt-4 text-center text-xs text-zinc-500">Grokbot only tags people who said yes. You can change consent any time.</p>
    </main>
  );
}

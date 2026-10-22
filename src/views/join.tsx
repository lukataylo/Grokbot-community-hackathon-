"use client";

import { useAppData } from "@/lib/client";
import { JoinForm } from "@/components/actions";
import { Loading } from "@/components/nav";
import { AppShell } from "@/components/app-shell";
import { Mascot, ScanIcon, Wordmark } from "@/components/ui";

export function JoinView({ eventId }: { eventId: string }) {
  const state = useAppData();
  if (!state) return <Loading />;
  const event = state.db.events.find((e) => e.id === eventId);
  if (!event) return <p className="p-10 text-center text-muted">Event not found.</p>;
  const me = state.db.attendees.find((a) => a.id === state.meId && a.eventId === eventId);
  return (
    <AppShell eventId={eventId} state={state} bare>
      <div className="-mx-5 bg-gradient-to-b from-[#6cc8ff] to-[#3fb3fa] px-6 pb-16 pt-6 text-center">
        <div className="text-left">
          <Wordmark light className="text-[1.65rem]" />
        </div>
        <Mascot className="mx-auto mt-2 w-64 -rotate-3" />
        <h1 className="mt-2 text-[2.6rem] font-extrabold leading-none tracking-[-0.04em] text-navy">{me ? "Welcome back." : "Join tonight."}</h1>
        <p className="mt-2 text-lg text-navy/80">
          {event.shortName ?? event.name} · {event.venue}
        </p>
      </div>
      <div className="-mx-5 -mt-8 rounded-t-[2.25rem] bg-white px-6 pb-8 pt-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-glow-soft text-navy">
            <ScanIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold">Event QR recognised</p>
            <p className="text-xs text-muted">{event.hashtag} · nobody is tagged without saying yes</p>
          </div>
        </div>
        <JoinForm key={me?.id ?? "new"} eventId={eventId} initial={me} />
      </div>
    </AppShell>
  );
}

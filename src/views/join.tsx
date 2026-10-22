"use client";

import { useAppData } from "@/lib/client";
import { JoinForm } from "@/components/actions";
import { Loading } from "@/components/nav";
import { Logo, Mascot } from "@/components/ui";

export function JoinView({ eventId }: { eventId: string }) {
  const state = useAppData();
  const event = state?.db.events.find((e) => e.id === eventId);
  const me = state?.db.attendees.find((a) => a.id === state.meId && a.eventId === eventId);
  return (
    <div className="flex min-h-[100dvh] items-center justify-center md:p-6">
      <div className="flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-white md:min-h-0 md:rounded-[44px] md:border-[3px] md:border-navy md:shadow-[0_30px_80px_-30px_rgba(14,29,79,0.45)]">
        <div className="bg-gradient-to-b from-[#62bdf8] to-sky px-6 pb-14 pt-6">
          <Logo light />
          <Mascot pose="wave" className="mx-auto mt-2 w-60" />
          <h1 className="mt-2 text-center text-4xl font-extrabold tracking-tight text-navy">{me ? "Welcome back." : "Join tonight."}</h1>
          <p className="mt-1 text-center font-medium text-navy/70">
            {event ? `${event.shortName ?? event.name} · ${event.venue}` : "\u00a0"}
          </p>
        </div>
        <div className="-mt-8 flex-1 space-y-5 rounded-t-[32px] bg-white px-6 pb-8 pt-6">
          {!state ? (
            <Loading />
          ) : !event ? (
            <p className="text-center text-muted">Event not found.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ice text-navy">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 9h2v2H9zM13 13h2v2h-2zM13 9h2M9 13v2" /></svg>
                </span>
                <span className="text-sm font-medium text-ink">Event QR recognised</span>
              </div>
              <JoinForm key={me?.id ?? "new"} eventId={eventId} initial={me} />
              <p className="text-center text-xs text-muted">Change your preferences anytime.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

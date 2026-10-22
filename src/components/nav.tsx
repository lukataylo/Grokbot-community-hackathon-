"use client";

import Link from "next/link";
import type { AppState } from "@/lib/client";
import { Badge, Wordmark } from "./ui";

/** Organiser navigation (desktop). Attendees get the mobile AppShell instead. */
export function Nav({ eventId, active, state }: { eventId: string; active: string; state: AppState | null }) {
  const event = state?.db.events.find((e) => e.id === eventId);
  const links = [
    ["organiser", "Dashboard", `/organiser/${eventId}`],
    ["autopilot", "Autopilot", `/organiser/${eventId}/autopilot`],
    ["digest", "Weekly digest", `/organiser/digest`],
    ["plan", "Share plan", `/e/${eventId}/plan`],
  ];
  const live = state?.mode === "grok";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <Wordmark className="text-2xl" />
          <span className="eyebrow hidden sm:inline">Organiser</span>
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1 text-sm">
          {links.map(([k, label, href]) => (
            <Link key={k} href={href} className={`rounded-full px-3.5 py-1.5 font-medium transition ${active === k ? "bg-navy text-white" : "text-muted hover:bg-mist hover:text-navy"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <span className="hidden text-sm text-muted md:inline">{event?.hashtag}</span>
        {state && <Badge tone={live ? "green" : "amber"}>{live ? "Grok live" : "Grok mock"}</Badge>}
        <Link href={`/e/${eventId}`} className="btn-ghost px-3.5 py-1.5 text-xs">Attendee app ↗</Link>
      </div>
    </header>
  );
}

export function Loading() {
  return <div className="grid min-h-[50vh] place-items-center text-sm text-muted">Loading…</div>;
}

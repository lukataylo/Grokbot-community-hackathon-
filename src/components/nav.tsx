"use client";

import Link from "next/link";
import type { AppState } from "@/lib/client";
import { Avatar, Badge, GrokMark } from "./ui";
import { SignInAs } from "./actions";

export function Nav({ eventId, active, state }: { eventId: string; active: string; state: AppState | null }) {
  const event = state?.db.events.find((e) => e.id === eventId);
  const people = state?.db.attendees.filter((a) => a.eventId === eventId) ?? [];
  const me = people.find((a) => a.id === state?.meId);
  const links = [
    ["gallery", "Gallery", `/e/${eventId}`],
    ["me", "My photos", `/e/${eventId}/me`],
    ["plan", "Share plan", `/e/${eventId}/plan`],
    ["leaderboard", "Leaderboard", `/e/${eventId}/leaderboard`],
    ["organiser", "Organiser", `/organiser/${eventId}`],
    ["autopilot", "Autopilot", `/organiser/${eventId}/autopilot`],
  ];
  const live = state?.mode === "grok";
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-black">
            <GrokMark className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Grokbot Event Autopilot</span>
        </Link>
        <span className="hidden text-sm text-zinc-500 md:inline">{event?.hashtag}</span>
        <nav className="flex flex-1 flex-wrap gap-1 text-sm">
          {links.map(([k, label, href]) => (
            <Link key={k} href={href} className={`rounded-lg px-3 py-1.5 ${active === k ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>
              {label}
            </Link>
          ))}
        </nav>
        {state && <Badge tone={live ? "green" : "amber"}>{live ? "Grok live" : "Grok mock"}</Badge>}
        <SignInAs attendees={people} currentId={me?.id} />
        {me && <Avatar a={me} size={30} />}
      </div>
    </header>
  );
}

export function Loading() {
  return <div className="grid min-h-[50vh] place-items-center text-sm text-zinc-500">Loading event…</div>;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppState } from "@/lib/client";
import { Avatar, Badge, Logo, Mascot, PhotosIcon, SparkleIcon, TrophyIcon } from "./ui";
import { SignInAs } from "./actions";

export type Tab = "photos" | "leaderboard" | "grok";

function AvatarMenu({ eventId, state }: { eventId: string; state: AppState | null }) {
  const [open, setOpen] = useState(false);
  const people = state?.db.attendees.filter((a) => a.eventId === eventId) ?? [];
  const me = people.find((a) => a.id === state?.meId);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-full ring-2 ring-sky-soft transition hover:ring-sky" aria-label="Account">
        {me ? <Avatar a={me} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-ice text-muted">?</span>}
      </button>
      {open && (
        <div className="card absolute right-0 top-12 z-30 w-64 space-y-3 p-4">
          {me ? (
            <div>
              <p className="font-bold">{me.name}</p>
              <p className="text-xs text-muted">@{me.xHandle}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Not signed in</p>
          )}
          <SignInAs attendees={people} currentId={me?.id} />
          <div className="flex flex-col gap-1 text-sm font-semibold">
            <Link href={`/join/${eventId}`} className="rounded-xl px-2 py-1.5 hover:bg-ice">{me ? "Edit consent" : "Join the event"}</Link>
            <Link href={`/organiser/${eventId}`} className="rounded-xl px-2 py-1.5 hover:bg-ice">Organiser view</Link>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS: { key: Tab; label: string; href: (id: string) => string; Icon: typeof PhotosIcon }[] = [
  { key: "photos", label: "Photos", href: (id) => `/e/${id}`, Icon: PhotosIcon },
  { key: "leaderboard", label: "Leaderboard", href: (id) => `/e/${id}/leaderboard`, Icon: TrophyIcon },
  { key: "grok", label: "Grok", href: (id) => `/e/${id}/me`, Icon: SparkleIcon },
];

/** Phone-sized attendee shell matching the afterglow mockups; framed like a device on wide screens. */
export function AppShell({ eventId, tab, state, children }: { eventId: string; tab: Tab; state: AppState | null; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center gap-12 md:p-6">
      <aside className="hidden max-w-xs space-y-5 lg:block">
        <Logo className="text-3xl" />
        <p className="text-lg font-semibold leading-snug text-ink">Every event photo, tagged with consent and shared for maximum reach.</p>
        <Mascot pose="walk" className="w-56" />
        <div className="space-y-2 text-sm">
          <Link href={`/organiser/${eventId}`} className="btn-ghost w-full">Open organiser dashboard</Link>
          {state && <Badge tone={state.mode === "grok" ? "green" : "amber"}>{state.mode === "grok" ? "Grok live" : "Grok mock mode"}</Badge>}
        </div>
      </aside>
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f7fbff] md:h-[min(900px,calc(100dvh-3rem))] md:rounded-[44px] md:border-[3px] md:border-navy md:shadow-[0_30px_80px_-30px_rgba(14,29,79,0.45)]">
        <header className="flex items-center justify-between px-6 pb-2 pt-6">
          <Link href="/"><Logo /></Link>
          <AvatarMenu eventId={eventId} state={state} />
        </header>
        <main className="flex-1 overflow-y-auto px-5 pb-28 pt-2">{children}</main>
        <nav className="absolute inset-x-4 bottom-4 flex rounded-[28px] border border-line bg-white/95 p-1.5 shadow-[0_10px_30px_-12px_rgba(14,29,79,0.3)] backdrop-blur">
          {TABS.map(({ key, label, href, Icon }) => (
            <Link
              key={key}
              href={href(eventId)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-[22px] py-2.5 text-xs font-semibold transition ${tab === key ? "bg-sky-soft text-navy" : "text-ink/70 hover:text-navy"}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function OrganiserBar({ eventId, state }: { eventId: string; state: AppState | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/"><Logo /></Link>
        <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-white">Organiser</span>
        <nav className="flex flex-1 gap-1 text-sm font-semibold">
          <Link href={`/e/${eventId}`} className="rounded-full px-3 py-1.5 text-ink hover:bg-ice">Attendee app</Link>
          <Link href={`/e/${eventId}/plan`} className="rounded-full px-3 py-1.5 text-ink hover:bg-ice">Share plan</Link>
          <Link href={`/e/${eventId}/leaderboard`} className="rounded-full px-3 py-1.5 text-ink hover:bg-ice">Leaderboard</Link>
        </nav>
        {state && <Badge tone={state.mode === "grok" ? "green" : "amber"}>{state.mode === "grok" ? "Grok live" : "Grok mock"}</Badge>}
        <AvatarMenu eventId={eventId} state={state} />
      </div>
    </header>
  );
}

export function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-muted">
      <div className="flex flex-col items-center gap-3">
        <Mascot pose="peek" className="w-24 animate-bounce" />
        Loading event…
      </div>
    </div>
  );
}

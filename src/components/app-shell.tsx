"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, type AppState } from "@/lib/client";
import { Avatar, PhotoIcon, SparkleIcon, TrophyIcon, UserIcon, Wordmark } from "./ui";

/** Mobile-first attendee app: wordmark + avatar, a page heading and the Photos / Leaderboard / Grok tab bar. */
export function AppShell({ eventId, state, title, children, bare }: { eventId: string; state: AppState | null; title?: string; children: React.ReactNode; bare?: boolean }) {
  const event = state?.db.events.find((e) => e.id === eventId);
  const people = state?.db.attendees.filter((a) => a.eventId === eventId) ?? [];
  const me = people.find((a) => a.id === state?.meId);
  const path = usePathname()?.replace(/\/$/, "") ?? "";
  const tabs = [
    { href: `/e/${eventId}`, label: "Photos", Icon: PhotoIcon },
    { href: `/e/${eventId}/leaderboard`, label: "Leaderboard", Icon: TrophyIcon },
    { href: `/e/${eventId}/me`, label: "Grok", Icon: SparkleIcon },
  ];
  return (
    <div className="min-h-screen sm:py-8">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-[#f7fbff] sm:min-h-[860px] sm:overflow-hidden sm:rounded-[2.75rem] sm:border-[3px] sm:border-navy sm:shadow-[0_30px_80px_-30px_rgba(12,31,77,0.45)]">
        {!bare && (
          <header className="flex items-center justify-between px-6 pt-6">
            <Link href={`/e/${eventId}`}>
              <Wordmark className="text-[1.65rem]" />
            </Link>
            <ProfileMenu eventId={eventId} state={state} />
          </header>
        )}
        <main className={`flex-1 px-5 ${bare ? "" : "pb-4 pt-4"}`}>
          {title && (
            <div className="mb-4 px-1">
              <p className="eyebrow">{event?.shortName ?? event?.name}</p>
              <h1 className="mt-1 text-[2.1rem] font-extrabold leading-tight tracking-[-0.03em]">{title}</h1>
            </div>
          )}
          {children}
        </main>
        {!bare && (
          <nav className="sticky bottom-0 z-20 space-y-2 px-4 pb-4 pt-2">
            {!me && state && (
              <Link href={`/join/${eventId}`} className="btn-primary w-full py-3 shadow-lg">
                Join the event to upload and get tagged
              </Link>
            )}
            <div className="flex gap-1 rounded-[1.75rem] border border-line bg-white/95 p-1.5 shadow-[0_12px_30px_-12px_rgba(12,31,77,0.35)] backdrop-blur">
              {tabs.map(({ href, label, Icon }) => {
                const on = path === href;
                return (
                  <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 text-xs font-medium transition ${on ? "bg-glow-soft text-navy" : "text-muted hover:text-navy"}`}>
                    <Icon className="h-6 w-6" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

function ProfileMenu({ eventId, state }: { eventId: string; state: AppState | null }) {
  const [open, setOpen] = useState(false);
  const people = state?.db.attendees.filter((a) => a.eventId === eventId) ?? [];
  const me = people.find((a) => a.id === state?.meId);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="rounded-full ring-offset-2 transition hover:ring-2 hover:ring-glow" aria-label="Profile">
        {me ? <Avatar a={me} size={46} /> : <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-white text-muted ring-1 ring-line"><UserIcon /></span>}
      </button>
      {open && (
        <div className="absolute right-0 top-14 z-30 w-64 space-y-3 rounded-3xl border border-line bg-white p-4 shadow-xl">
          {me ? (
            <div>
              <p className="font-semibold">{me.name}</p>
              <p className="text-xs text-muted">@{me.xHandle}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">You haven&apos;t joined yet.</p>
          )}
          <Link href={`/join/${eventId}`} className="btn-ghost w-full">{me ? "Edit my preferences" : "Join the event"}</Link>
          <label className="block text-xs text-muted">
            Demo: sign in as
            <select
              className="input mt-1 py-2"
              value={me?.id ?? ""}
              onChange={async (e) => {
                await api.login(e.target.value || null);
                setOpen(false);
              }}
            >
              <option value="">Nobody</option>
              {people.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <Link href={`/organiser/${eventId}`} className="block text-center text-xs font-semibold text-glow-deep hover:underline">Organiser dashboard →</Link>
        </div>
      )}
    </div>
  );
}

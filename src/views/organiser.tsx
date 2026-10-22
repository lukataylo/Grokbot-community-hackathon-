"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { api, BASE, STATIC, useAppData } from "@/lib/client";
import { leaderboard } from "@/lib/points";
import { Loading, OrganiserBar } from "@/components/nav";
import { ActionButton, BotConsole } from "@/components/actions";
import { Avatar, Mascot, SparkleIcon, relTime } from "@/components/ui";

const KIND_ICON = { join: "🎟", upload: "📷", tag: "🏷", task: "🚀", bot: "🤖", plan: "🗓" } as const;

export function OrganiserView({ eventId }: { eventId: string }) {
  const state = useAppData(4000);
  const [joinUrl, setJoinUrl] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_PUBLIC_URL ?? window.location.origin}${BASE}/join/${eventId}${STATIC ? "/" : ""}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 320 }).then(setQr);
  }, [eventId]);
  if (!state) return <><OrganiserBar eventId={eventId} state={state} /><Loading /></>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const photos = db.photos.filter((p) => p.eventId === eventId);
  const tasks = db.tasks.filter((t) => t.eventId === eventId);
  const done = tasks.filter((t) => t.status === "done");
  const reach = leaderboard(db, eventId).reduce((s, x) => s + x.reach, 0);
  const pending = photos.filter((p) => p.status === "pending").length;
  const stats = [
    ["Attendees", people.length, `${people.filter((a) => a.consentTag).length} opted into tagging`],
    ["Photos", photos.length, `${pending} waiting for Grok`],
    ["Tags delivered", photos.reduce((s, p) => s + p.tags.length, 0), `${photos.reduce((s, p) => s + p.withheld.length, 0)} withheld for consent`],
    ["Share tasks", `${done.length}/${tasks.length}`, "done / planned"],
    ["Est. reach", reach.toLocaleString(), "followers reached"],
  ];
  return (
    <>
      <OrganiserBar eventId={eventId} state={state} />
      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        {STATIC && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Static preview: everything runs in your browser with mock Grok and seeded data saved to this browser only. &quot;Reset demo&quot; restores the seed.
          </p>
        )}
        <div className="relative overflow-hidden rounded-[32px] bg-sky p-7 pr-56">
          <p className="eyebrow text-navy/70">Organiser · @{event.organiserHandle}</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-navy">{event.name}</h1>
          <p className="mt-1 font-medium text-navy/70">{event.venue} · {event.hashtag}</p>
          <Mascot pose="peek" className="absolute -bottom-6 right-6 w-48" />
          <div className="mt-5 flex flex-wrap gap-2">
            <ActionButton run={() => api.tag(eventId)} className="btn-primary" label={<><SparkleIcon className="h-4 w-4" /> Run Grok tagging{pending ? ` (${pending})` : ""}</>} busyLabel="Grok is looking…" />
            <ActionButton run={() => api.plan(eventId)} className="btn-ghost" label={<><SparkleIcon className="h-4 w-4" /> Generate share plan</>} busyLabel="Planning…" />
            <ActionButton run={() => api.reset()} label="Reset demo" className="btn-ghost" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          {stats.map(([label, value, sub]) => (
            <div key={label as string} className="card p-4">
              <p className="eyebrow">{label}</p>
              <p className="mt-1 text-3xl font-extrabold">{value}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr_1fr]">
          <div className="card flex flex-col items-center p-5 text-center">
            <p className="mb-3 font-bold">Scan to join</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt="Join QR code" className="w-52 rounded-xl" /> : <div className="h-52 w-52 rounded-xl bg-white/5" />}
            <Link href={`/join/${eventId}`} className="mt-3 break-all text-xs text-sky hover:underline">
              {joinUrl}
            </Link>
          </div>
          <BotConsole eventId={eventId} />
          <div className="card p-4">
            <h3 className="mb-3 font-bold">Live activity</h3>
            <ul className="space-y-2 overflow-y-auto text-sm" style={{ maxHeight: 330 }}>
              {db.activity.filter((a) => a.eventId === eventId).slice(0, 25).map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span>{KIND_ICON[a.kind]}</span>
                  <span className="flex-1 text-ink">{a.text}</span>
                  <span className="shrink-0 text-xs text-muted">{relTime(a.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-bold">Attendees & consent</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-ice p-2 text-sm">
                <Avatar a={a} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name} <span className="text-muted">@{a.xHandle}</span></p>
                  <p className="truncate text-xs text-muted">{a.lookFor || "no description"}</p>
                </div>
                <span title="photo consent">{a.consentPhoto ? "📷" : "🚫"}</span>
                <span title="tag consent">{a.consentTag ? "🏷" : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

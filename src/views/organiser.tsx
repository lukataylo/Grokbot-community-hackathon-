"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { api, BASE, STATIC, useAppData } from "@/lib/client";
import { leaderboard } from "@/lib/points";
import { Loading, Nav } from "@/components/nav";
import { ActionButton, BotConsole } from "@/components/actions";
import { Coordination } from "@/components/coordination";
import { Avatar, SparkleIcon, relTime } from "@/components/ui";

const KIND_ICON = { join: "🎟", upload: "📷", tag: "🏷", task: "🚀", bot: "🤖", plan: "🗓", kit: "✨", announce: "📣" } as const;

export function OrganiserView({ eventId }: { eventId: string }) {
  const state = useAppData(4000);
  const [joinUrl, setJoinUrl] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_PUBLIC_URL ?? window.location.origin}${BASE}/join/${eventId}${STATIC ? "/" : ""}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 320 }).then(setQr);
  }, [eventId]);
  if (!state) return <><Nav eventId={eventId} active="organiser" state={state} /><Loading /></>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const photos = db.photos.filter((p) => p.eventId === eventId);
  const tasks = db.tasks.filter((t) => t.eventId === eventId);
  const done = tasks.filter((t) => t.status === "done");
  const reach = leaderboard(db, eventId).reduce((s, x) => s + x.reach, 0);
  const pending = photos.filter((p) => p.status === "pending").length;
  const kept = new Set(photos.flatMap((p) => p.withheld.map((w) => w.attendeeId))).size;
  const stats = [
    ["Checked in", people.length, `via QR · ${people.filter((a) => a.consentTag).length} said yes to tagging`],
    ["Photos", photos.length, pending ? `${pending} waiting for Grok` : `from ${new Set(photos.map((p) => p.uploaderId)).size} camera rolls`],
    ["People found", photos.reduce((s, p) => s + p.tags.length, 0), "tags delivered by Grok"],
    ["Kept private", kept, "recognised, not tagged or shown"],
    ["Engagement", `${done.length}/${tasks.length}`, "posts, replies, upvotes, reposts"],
    ["Est. reach", reach.toLocaleString(), "followers reached"],
  ];
  return (
    <>
      <Nav eventId={eventId} active="organiser" state={state} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {STATIC && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Static preview: everything runs in your browser with mock Grok and seeded data saved to this browser only. &quot;Reset demo&quot; restores the seed.
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Organiser · @{event.organiserHandle}</p>
            <h1 className="text-3xl font-extrabold tracking-tight">{event.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton className={pending ? "btn-grok" : "btn-ghost"} run={() => api.tag(eventId)} label={<><SparkleIcon className="h-4 w-4" /> {pending ? `Find people in ${pending} new photo${pending > 1 ? "s" : ""}` : "Re-run Grok tagging"}</>} busyLabel="Grok is looking…" />
            <Link href={`/organiser/${eventId}/timeline`} className="btn-primary">▶ Play the timeline</Link>
            <ActionButton run={() => api.reset()} label="Reset demo" className="btn-ghost" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(([label, value, sub]) => (
            <div key={label as string} className="card p-4">
              <p className="eyebrow">{label}</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{value}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr_1fr]">
          <div className="card flex flex-col items-center p-5 text-center">
            <p className="font-bold">Scan to join</p>
            <p className="mb-3 text-xs text-muted">Put this on the screen and the door</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt="Join QR code" className="w-52 rounded-xl" /> : <div className="h-52 w-52 rounded-xl bg-mist" />}
            <Link href={`/join/${eventId}`} className="mt-3 break-all text-xs text-glow-deep hover:underline">
              {joinUrl}
            </Link>
          </div>
          <Coordination db={db} eventId={eventId} />
          <div className="card p-4">
            <h3 className="mb-3 font-bold">Live activity</h3>
            <ul className="space-y-2 overflow-y-auto text-sm" style={{ maxHeight: 330 }}>
              {db.activity.filter((a) => a.eventId === eventId).slice(0, 25).map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span>{KIND_ICON[a.kind]}</span>
                  <span className="flex-1 text-navy/80">{a.text}</span>
                  <span className="shrink-0 text-xs text-muted">{relTime(a.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <BotConsole eventId={eventId} />
        <div className="card p-4">
          <h3 className="mb-1 font-bold">Attendees &amp; consent</h3>
          <p className="mb-3 text-xs text-muted">📷 can appear in photos · 🏷 can be tagged. Grok checks these after every match, so a model mistake can&apos;t override a no.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {people.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-mist p-2 text-sm">
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
        </div>
        <p className="text-center text-xs text-muted">
          Also built tonight: <Link href={`/organiser/${eventId}/autopilot`} className="font-semibold text-glow-deep hover:underline">Event Autopilot</Link>, which drafts the promo kit and weekly digest for the next event.
        </p>
      </main>
    </>
  );
}

"use client";

import { useState } from "react";
import { api, useAppData } from "@/lib/client";
import { DEFAULT_CALENDAR } from "@/lib/digest";
import { dayLabel, timeLabel } from "@/lib/kit";
import { MANUAL_MINUTES } from "@/lib/hours";
import { Loading, Nav } from "@/components/nav";
import { ActionButton } from "@/components/actions";
import { Badge, SparkleIcon } from "@/components/ui";

export function DigestView({ eventId }: { eventId: string }) {
  const state = useAppData(0);
  const [calendar, setCalendar] = useState(DEFAULT_CALENDAR);
  const [community, setCommunity] = useState("");
  if (!state) return <><Nav eventId={eventId} active="digest" state={state} /><Loading /></>;
  const d = state.db.digest;
  const name = community || state.db.kits?.[eventId]?.brand.community || "Grok Bot London";
  const tone = (s: string) => (s === "draft" ? "amber" : s === "approved" ? "green" : "sky") as "amber" | "green" | "sky";
  return (
    <>
      <Nav eventId={eventId} active="digest" state={state} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <p className="text-sm text-glow-deep">Weekly digest</p>
          <h1 className="text-3xl font-bold">This week&apos;s events, drafted into a newsletter and a group message.</h1>
          <p className="mt-1 text-muted">Pulls your Luma calendar feed, keeps the next 7 days and writes both. Saves about {MANUAL_MINUTES.digest / 60}h every week.</p>
        </div>
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <label className="flex-1 text-sm font-medium">
            Luma calendar id or .ics URL
            <input className="input mt-1 font-mono text-xs" value={calendar} onChange={(e) => setCalendar(e.target.value)} />
          </label>
          <label className="w-56 text-sm font-medium">
            Community
            <input className="input mt-1" value={community} onChange={(e) => setCommunity(e.target.value)} placeholder={name} />
          </label>
          <ActionButton run={() => api.digest(calendar, name)} label={<><SparkleIcon className="h-4 w-4" /> Draft this week</>} busyLabel="Reading the calendar…" />
        </div>
        {d && (
          <>
            <p className="text-sm text-muted">
              {d.events.length} events in the next 7 days ·{" "}
              {d.feed === "luma" ? <Badge tone="green">live Luma feed</Badge> : <Badge tone="amber">sample feed: Luma could not be reached from here</Badge>}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Newsletter</h3>
                  <Badge tone={tone(d.newsletter.status)}>{d.newsletter.status}</Badge>
                  <div className="ml-auto flex gap-1.5">
                    {d.newsletter.status === "draft" && <ActionButton run={() => api.digestItem("newsletter", { status: "approved" })} label="✓ Approve" className="btn-grok px-3 py-1 text-xs" />}
                    {d.newsletter.status === "approved" && <ActionButton run={() => api.digestItem("newsletter", { status: "sent" })} label="Mark sent" className="btn-primary px-3 py-1 text-xs" />}
                  </div>
                </div>
                <p className="text-sm font-semibold">{d.newsletter.data.subject}</p>
                <iframe title="Digest preview" srcDoc={`<body style="margin:0;padding:16px;background:#fff">${d.newsletter.data.html}</body>`} className="h-96 w-full rounded-xl bg-white" sandbox="" />
              </div>
              <div className="card space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">WhatsApp group message</h3>
                  <Badge tone={tone(d.whatsapp.status)}>{d.whatsapp.status}</Badge>
                  <div className="ml-auto flex gap-1.5">
                    {d.whatsapp.status === "draft" && <ActionButton run={() => api.digestItem("whatsapp", { status: "approved" })} label="✓ Approve" className="btn-grok px-3 py-1 text-xs" />}
                    {d.whatsapp.status !== "draft" && (
                      <a href={`https://wa.me/?text=${encodeURIComponent(d.whatsapp.data.text)}`} target="_blank" rel="noreferrer" onClick={() => api.digestItem("whatsapp", { status: "sent" })} className="btn-ghost px-3 py-1 text-xs">
                        Open WhatsApp ↗
                      </a>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap rounded-2xl bg-mist p-4 text-sm leading-relaxed text-navy">{d.whatsapp.data.text}</p>
                <ul className="space-y-1 text-xs text-muted">
                  {d.events.map((e, i) => (
                    <li key={i}>
                      <span className="font-mono text-glow-deep">{dayLabel(e.start).split(",")[0]} {timeLabel(e.start)}</span> {e.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

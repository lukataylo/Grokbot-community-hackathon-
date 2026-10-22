"use client";

import { useEffect, useState } from "react";
import { photoSrc, useAppData } from "@/lib/client";
import { timeline } from "@/lib/engine";
import { Loading, Nav } from "@/components/nav";
import { Avatar, Mascot, fmtTime } from "@/components/ui";

/** Big-screen replay of the night, built from the photos' capture times. Made for the projector at the end. */
export function ReplayView({ eventId }: { eventId: string }) {
  const state = useAppData(4000);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const moments = state ? timeline(state.db, eventId) : [];
  const frames = moments.flatMap((m, mi) => m.photos.map((p) => ({ m, mi, p })));
  const n = frames.length;

  useEffect(() => {
    if (!playing || n < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % n), 3500);
    return () => clearInterval(t);
  }, [playing, n]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setFrame((f) => (f + 1) % Math.max(1, n));
      if (e.key === "ArrowLeft") setFrame((f) => (f - 1 + n) % Math.max(1, n));
      if (e.key === " ") setPlaying((p) => !p);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [n]);

  if (!state) return <><Nav eventId={eventId} active="timeline" state={state} /><Loading /></>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const cur = frames[Math.min(frame, n - 1)];
  const tagged = cur ? cur.p.tags.map((t) => people.find((a) => a.id === t.attendeeId)).filter((a) => !!a) : [];
  const kept = cur ? cur.p.withheld.length : 0;
  return (
    <>
      <Nav eventId={eventId} active="timeline" state={state} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{event.shortName ?? event.name} · replay</p>
            <h1 className="text-4xl font-extrabold tracking-tight">Tonight, in photos</h1>
            <p className="mt-1 text-muted">Built from every camera roll in the room, in the order things happened. People who opted out stay blurred or untagged.</p>
          </div>
          <button className="btn-primary" onClick={() => setPlaying(!playing)}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
        </div>
        {!cur ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <Mascot pose="wave" className="w-40" />
            <p className="mt-4 font-semibold">No photos yet</p>
            <p className="text-sm text-muted">Attendees scan the QR and upload. The replay builds itself.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="relative overflow-hidden rounded-[2rem] bg-navy shadow-[0_30px_60px_-30px_rgba(12,31,77,0.6)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={cur.p.id} src={photoSrc(cur.p, db)} alt={cur.p.caption} className="aspect-[4/3] w-full animate-[fadein_.6s_ease] object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent p-6 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-glow">{fmtTime(cur.p.takenAt)} · {cur.m.place}</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">{cur.p.caption}</p>
              </div>
            </div>
            <div className="card flex flex-col p-6">
              <p className="eyebrow">Moment {cur.mi + 1} of {moments.length}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{cur.m.place}</p>
              <p className="text-sm text-muted">
                {fmtTime(cur.m.start)}
                {cur.m.end !== cur.m.start && `–${fmtTime(cur.m.end)}`} · {cur.m.photos.length} photo{cur.m.photos.length > 1 ? "s" : ""}
              </p>
              <p className="mt-5 text-sm font-semibold">In this photo</p>
              <ul className="mt-2 space-y-2">
                {tagged.map((a) => (
                  <li key={a!.id} className="flex items-center gap-3">
                    <Avatar a={a!} size={34} />
                    <span className="font-medium">{a!.name}</span>
                    <span className="text-sm text-muted">@{a!.xHandle}</span>
                  </li>
                ))}
                {!tagged.length && <li className="text-sm text-muted">Nobody tagged</li>}
              </ul>
              {kept > 0 && <p className="mt-3 rounded-2xl bg-mist px-3 py-2 text-xs text-muted">🛡 {kept} {kept > 1 ? "people" : "person"} in this photo asked not to be tagged or shown. Grok respected it.</p>}
              <p className="mt-auto pt-5 text-xs text-muted">← → to step · space to pause</p>
            </div>
          </div>
        )}
        {n > 0 && (
          <div className="card overflow-x-auto p-4">
            <div className="flex min-w-max items-end gap-1.5">
              {frames.map((f, i) => (
                <button key={f.p.id} onClick={() => { setFrame(i); setPlaying(false); }} className="group flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoSrc(f.p, db)} alt="" className={`h-14 w-20 rounded-xl object-cover transition ${i === frame ? "ring-4 ring-glow" : "opacity-60 group-hover:opacity-100"}`} />
                  <span className={`text-[10px] font-semibold ${i === frame ? "text-navy" : "text-muted"}`}>{fmtTime(f.p.takenAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

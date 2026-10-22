"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { api, photoSrc, useAppData } from "@/lib/client";
import { Loading } from "@/components/nav";
import { AppShell } from "@/components/app-shell";
import { PhotoCard } from "@/components/photo-card";
import { ChevronRight, Mascot, PlusIcon } from "@/components/ui";
import type { Photo } from "@/lib/types";

export function GalleryView({ eventId, initialTab = "all" }: { eventId: string; initialTab?: "all" | "me" }) {
  const state = useAppData(5000);
  const [tab, setTab] = useState(initialTab);
  const [open, setOpen] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!state) return <AppShell eventId={eventId} state={state} title="Event photos"><Loading /></AppShell>;
  const { db } = state;
  const me = db.attendees.find((a) => a.id === state.meId);
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const all = db.photos.filter((p) => p.eventId === eventId).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const mine = all.filter((p) => me && p.tags.some((t) => t.attendeeId === me.id));
  const photos = tab === "me" ? mine : all;
  const contributors = new Set(all.map((p) => p.uploaderId)).size;
  const current = open && db.photos.find((p) => p.id === open.id);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    await api.upload(Array.from(files), "Event moment");
    setBusy(false);
  }

  return (
    <AppShell eventId={eventId} state={state} title="Event photos">
      <div className="seg mb-4">
        <button className={`seg-item ${tab === "all" ? "seg-on" : ""}`} onClick={() => setTab("all")}>All photos</button>
        <button className={`seg-item ${tab === "me" ? "seg-on" : ""}`} onClick={() => setTab("me")}>Photos of me{me ? ` · ${mine.length}` : ""}</button>
      </div>

      {photos.length ? (
        <div className="grid grid-cols-2 gap-2.5">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)} className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-200 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(p, db)} alt={p.caption} className={`h-full w-full object-cover transition group-hover:scale-105 ${p.hidden ? "blur-xl" : ""}`} />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent px-2.5 pb-2 pt-6 text-xs font-medium text-white">
                {p.hidden ? "🔒 Hidden for consent" : p.caption}
              </span>
              {p.status === "pending" ? (
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Grok is looking…</span>
              ) : p.tags.length > 0 ? (
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-navy">{p.tags.length} tagged</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="card p-6 text-center text-sm text-muted">
          {tab === "me" ? (me ? (me.consentTag ? "No photos of you yet. Grok will drop them here as people upload." : "You turned tagging off, so Grok won't match you in photos.") : "Join the event to see photos of you.") : "No photos yet. Be the first to upload."}
        </div>
      )}

      <p className="mt-3 px-1 text-sm text-muted">
        {all.length} photos · {contributors} contributors
      </p>

      {me && (
        <>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          <button className="btn-grok mt-4 w-full py-4 text-base" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Grok is tagging…" : <><PlusIcon className="h-5 w-5" /> Upload photos</>}
          </button>
          <Link href={`/e/${eventId}/me`} className="card mt-3 flex items-center gap-3 px-4 py-3">
            <Mascot pose="wave" className="w-12" />
            <span className="flex-1 text-sm font-medium">Draft a recap with Grok</span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Link>
        </>
      )}

      {current && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/40 backdrop-blur-sm sm:items-center" onClick={() => setOpen(null)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
            <PhotoCard photo={current} src={photoSrc(current, db)} people={people} highlight={me?.id} />
            <button className="btn-ghost mt-2 w-full" onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { photoSrc, useAppData } from "@/lib/client";
import { AppShell, Loading } from "@/components/nav";
import { PhotoDetail, PhotoTile } from "@/components/photo-card";
import { UploadButton } from "@/components/actions";
import { Mascot, Segmented } from "@/components/ui";

export function GalleryView({ eventId }: { eventId: string }) {
  const state = useAppData(5000);
  const [filter, setFilter] = useState<"all" | "me">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  if (!state) return <AppShell eventId={eventId} tab="photos" state={state}><Loading /></AppShell>;
  const { db } = state;
  const event = db.events.find((e) => e.id === eventId)!;
  const me = db.attendees.find((a) => a.id === state.meId);
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const all = db.photos.filter((p) => p.eventId === eventId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const photos = filter === "me" ? all.filter((p) => p.tags.some((t) => t.attendeeId === me?.id)) : all;
  const contributors = new Set(all.map((p) => p.uploaderId)).size;
  const open = all.find((p) => p.id === openId);
  const inSelection = [...new Set(all.filter((p) => selected.includes(p.id)).flatMap((p) => p.tags.map((t) => t.attendeeId)))]
    .filter((id) => id !== me?.id)
    .map((id) => "@" + people.find((a) => a.id === id)?.xHandle);
  const shareText = `Photos from ${event.name}${inSelection.length ? ` with ${inSelection.join(" ")}` : ""} 📸 ${event.hashtag}`;
  return (
    <AppShell eventId={eventId} tab="photos" state={state}>
      <div className="space-y-4">
        <div>
          <p className="eyebrow">{event.shortName ?? event.name}</p>
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Event photos</h1>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All photos" },
            { value: "me", label: "Photos of me" },
          ]}
        />
        {photos.length ? (
          <div className="grid grid-cols-2 gap-2.5">
            {photos.map((p) => (
              <PhotoTile
                key={p.id}
                photo={p}
                src={photoSrc(p, db)}
                selecting={selecting}
                selected={selected.includes(p.id)}
                onOpen={() => (selecting ? setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id])) : setOpenId(p.id))}
              />
            ))}
          </div>
        ) : (
          <div className="card flex items-center gap-3 p-4 text-sm text-muted">
            <Mascot pose="peek" className="w-16" />
            {me ? (me.consentTag ? "No photos of you yet. Grok will drop them here as people upload." : "You opted out of tagging, so Grok won't match you in photos.") : "Join the event to see the photos you're in."}
          </div>
        )}
        <div className="flex items-center justify-between px-1 text-xs text-muted">
          <span>
            {all.length} photos · {contributors} contributors
          </span>
          <button
            className="font-semibold text-sky"
            onClick={() => {
              setSelecting((v) => !v);
              setSelected([]);
            }}
          >
            {selecting ? "Cancel" : "Select"}
          </button>
        </div>
        {selecting ? (
          <a
            className={`btn-primary w-full py-4 text-base ${selected.length ? "" : "pointer-events-none opacity-40"}`}
            target="_blank"
            rel="noreferrer"
            href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}`}
          >
            Share {selected.length || ""} {selected.length === 1 ? "photo" : "photos"} on X
          </a>
        ) : me ? (
          <UploadButton />
        ) : (
          <Link href={`/join/${eventId}`} className="btn-grok w-full py-4 text-base">
            Join to upload photos
          </Link>
        )}
        <Link href={`/e/${eventId}/me`} className="card flex items-center gap-3 p-3 pr-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-sky-soft">
            <Mascot pose="peek" className="w-11 translate-y-1 drop-shadow-none" />
          </span>
          <span className="flex-1 text-sm font-medium text-ink">Draft a recap with Grok</span>
          <span className="text-lg text-ink">›</span>
        </Link>
      </div>
      {open && <PhotoDetail photo={open} src={photoSrc(open, db)} people={people} highlight={me?.id} onClose={() => setOpenId(null)} />}
    </AppShell>
  );
}

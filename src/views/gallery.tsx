"use client";

import { photoSrc, useAppData } from "@/lib/client";
import { Loading, Nav } from "@/components/nav";
import { PhotoCard } from "@/components/photo-card";
import { UploadForm } from "@/components/actions";

export function GalleryView({ eventId }: { eventId: string }) {
  const state = useAppData(5000);
  if (!state) return <><Nav eventId={eventId} active="gallery" state={state} /><Loading /></>;
  const { db } = state;
  const me = db.attendees.find((a) => a.id === state.meId);
  const photos = db.photos.filter((p) => p.eventId === eventId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const people = db.attendees.filter((a) => a.eventId === eventId);
  return (
    <>
      <Nav eventId={eventId} active="gallery" state={state} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold">Event gallery</h1>
          <p className="text-zinc-400">
            {photos.length} photos · {photos.filter((p) => p.status === "tagged").length} tagged by Grok
          </p>
        </div>
        {me ? <UploadForm /> : <p className="card p-4 text-sm text-zinc-400">Sign in (top right) or scan the QR to upload photos.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} src={photoSrc(p, db)} people={people} highlight={me?.id} />
          ))}
        </div>
      </main>
    </>
  );
}

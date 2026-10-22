import { readDB } from "@/lib/store";
import { currentAttendee } from "@/lib/session";
import { Nav } from "@/components/nav";
import { PhotoCard } from "@/components/photo-card";
import { UploadForm } from "@/components/actions";

export const dynamic = "force-dynamic";

export default async function Gallery({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const db = readDB();
  const me = await currentAttendee();
  const photos = db.photos.filter((p) => p.eventId === eventId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const people = db.attendees.filter((a) => a.eventId === eventId);
  return (
    <>
      <Nav eventId={eventId} active="gallery" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">Event gallery</h1>
            <p className="text-zinc-400">
              {photos.length} photos · {photos.filter((p) => p.status === "tagged").length} tagged by Grok
            </p>
          </div>
        </div>
        {me ? <UploadForm /> : <p className="card p-4 text-sm text-zinc-400">Sign in (top right) or scan the QR to upload photos.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} people={people} highlight={me?.id} />
          ))}
        </div>
      </main>
    </>
  );
}

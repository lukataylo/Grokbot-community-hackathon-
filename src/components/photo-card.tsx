import type { Attendee, Photo } from "@/lib/types";
import { Avatar, Badge, relTime } from "./ui";

export function PhotoCard({ photo, src, people, highlight }: { photo: Photo; src: string; people: Attendee[]; highlight?: string }) {
  const by = (id: string) => people.find((a) => a.id === id);
  const uploader = by(photo.uploaderId);
  return (
    <figure className="card overflow-hidden">
      <div className="relative aspect-[4/3] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={photo.caption} className={`h-full w-full object-cover ${photo.hidden ? "blur-xl" : ""}`} />
        {photo.hidden && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-center text-sm font-semibold">
            <span>🔒 Hidden: someone in this photo opted out of being photographed</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {photo.status === "pending" ? <Badge tone="amber">Waiting for Grok</Badge> : <Badge tone="fuchsia">Grok tagged</Badge>}
        </div>
      </div>
      <figcaption className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium">{photo.caption}</p>
          <span className="shrink-0 text-xs text-zinc-500">{relTime(photo.takenAt)}</span>
        </div>
        <p className="text-xs text-zinc-500">by @{uploader?.xHandle}</p>
        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {photo.tags.map((t) => {
              const a = by(t.attendeeId);
              if (!a) return null;
              return (
                <span key={t.attendeeId} title={t.reason} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs ${highlight === a.id ? "bg-fuchsia-500/30 ring-1 ring-fuchsia-400" : "bg-white/10"}`}>
                  <Avatar a={a} size={18} />@{a.xHandle}
                  <span className="text-zinc-500">{Math.round(t.confidence * 100)}%</span>
                </span>
              );
            })}
          </div>
        )}
        {photo.withheld.length > 0 && (
          <p className="text-xs text-amber-300/80">
            🛡 Consent: {photo.withheld.filter((w) => w.reason === "no-tag").length > 0 && `${photo.withheld.filter((w) => w.reason === "no-tag").length} recognised but not tagged`}
            {photo.withheld.filter((w) => w.reason === "no-tag").length > 0 && photo.withheld.some((w) => w.reason === "no-photo") && " · "}
            {photo.withheld.some((w) => w.reason === "no-photo") && `${photo.withheld.filter((w) => w.reason === "no-photo").length} ${photo.hidden ? "opted out, photo hidden" : "auto-blurred"}`}
          </p>
        )}
      </figcaption>
    </figure>
  );
}

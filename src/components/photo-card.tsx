import type { Attendee, Photo } from "@/lib/types";
import { Avatar, relTime } from "./ui";

/** Clean square gallery tile; consent state is the only overlay. */
export function PhotoTile({ photo, src, onOpen, selecting, selected }: { photo: Photo; src: string; onOpen?: () => void; selecting?: boolean; selected?: boolean }) {
  return (
    <button onClick={onOpen} className={`group relative aspect-square overflow-hidden rounded-2xl bg-ice text-left transition ${selected ? "ring-4 ring-sky" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={photo.caption} className={`h-full w-full object-cover transition group-hover:scale-105 ${photo.hidden ? "blur-xl" : ""}`} />
      {photo.status === "pending" && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-navy">Grok is looking…</span>}
      {photo.hidden && <span className="absolute inset-0 grid place-items-center text-2xl">🔒</span>}
      {selecting && (
        <span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white text-white ${selected ? "bg-sky" : "bg-black/20"}`}>
          {selected && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
          )}
        </span>
      )}
    </button>
  );
}

export function PhotoDetail({ photo, src, people, highlight, onClose }: { photo: Photo; src: string; people: Attendee[]; highlight?: string; onClose: () => void }) {
  const by = (id: string) => people.find((a) => a.id === id);
  const noTag = photo.withheld.filter((w) => w.reason === "no-tag").length;
  const noPhoto = photo.withheld.filter((w) => w.reason === "no-photo").length;
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-navy/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full space-y-3 rounded-t-[32px] bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={photo.caption} className={`aspect-[4/3] w-full rounded-2xl object-cover ${photo.hidden ? "blur-xl" : ""}`} />
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold">{photo.caption}</p>
            <p className="text-xs text-muted">by @{by(photo.uploaderId)?.xHandle} · {relTime(photo.takenAt)}</p>
          </div>
          <button onClick={onClose} className="btn-ghost px-3 py-1 text-xs">Close</button>
        </div>
        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {photo.tags.map((t) => {
              const a = by(t.attendeeId);
              if (!a) return null;
              return (
                <span key={t.attendeeId} title={t.reason} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-semibold ${highlight === a.id ? "bg-sky text-navy" : "bg-ice text-ink"}`}>
                  <Avatar a={a} size={20} />@{a.xHandle}
                  <span className="font-medium text-muted">{Math.round(t.confidence * 100)}%</span>
                </span>
              );
            })}
          </div>
        )}
        {(noTag > 0 || noPhoto > 0) && (
          <p className="rounded-2xl bg-sky-soft px-3 py-2 text-xs font-medium text-navy">
            🛡 Consent respected:{noTag > 0 && ` ${noTag} recognised but not tagged`}
            {noTag > 0 && noPhoto > 0 && " ·"}
            {noPhoto > 0 && ` ${noPhoto} ${photo.hidden ? "opted out, photo hidden" : "auto-blurred"}`}
          </p>
        )}
      </div>
    </div>
  );
}

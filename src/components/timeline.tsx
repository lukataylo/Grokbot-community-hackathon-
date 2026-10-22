import type { Attendee, DB, Photo } from "@/lib/types";
import type { Moment } from "@/lib/engine";
import { photoSrc } from "@/lib/client";
import { Avatar, fmtTime } from "./ui";

/** The night as a vertical timeline: each moment is a place, a time range, its photos and who was there. */
export function TimelineList({ moments, db, people, onOpen, highlight }: { moments: Moment[]; db: DB; people: Attendee[]; onOpen: (p: Photo) => void; highlight?: string }) {
  if (!moments.length) return <p className="card p-6 text-center text-sm text-muted">The timeline builds itself as photos come in.</p>;
  return (
    <ol className="relative ml-3 space-y-6 border-l-2 border-dashed border-glow/50 pl-6">
      {moments.map((m, i) => {
        const who = m.people.map((id) => people.find((a) => a.id === id)).filter((a): a is Attendee => !!a);
        const mine = highlight && m.people.includes(highlight);
        return (
          <li key={i} className="relative">
            <span className={`absolute -left-[34px] top-1 grid h-5 w-5 place-items-center rounded-full border-4 border-[#f7fbff] ${mine ? "bg-navy" : "bg-glow"}`} />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-glow-deep">
              {fmtTime(m.start)}
              {m.end !== m.start && `–${fmtTime(m.end)}`} · {m.place}
            </p>
            <p className="mt-0.5 font-bold">{m.photos[0].caption}</p>
            <div className="-mr-5 mt-2 flex gap-2 overflow-x-auto pb-1 pr-5">
              {m.photos.map((p) => (
                <button key={p.id} onClick={() => onOpen(p)} className="shrink-0 overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoSrc(p, db)} alt={p.caption} className="h-28 w-36 object-cover transition hover:scale-105" />
                </button>
              ))}
            </div>
            {who.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {who.slice(0, 6).map((a) => (
                    <Avatar key={a.id} a={a} size={24} />
                  ))}
                </div>
                <span className="text-xs text-muted">
                  {who.length} {who.length === 1 ? "person" : "people"} tagged{mine ? " · including you" : ""}
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

import type { DB } from "@/lib/types";
import { hoursSaved, KIT_POTENTIAL_HOURS } from "@/lib/hours";

/** The headline number: volunteer hours saved, with the per-piece breakdown on hover and on expand. */
export function HoursSaved({ db, eventId, big }: { db: DB; eventId: string; big?: boolean }) {
  const { hours, lines } = hoursSaved(db, eventId);
  const breakdown = lines.map((l) => `${l.label}: ${l.minutes} min`).join("\n");
  return (
    <div className={`card p-4 ${big ? "bg-gradient-to-br from-emerald-500/15 to-transparent" : ""}`} title={breakdown || "Approve pieces to start saving time"}>
      <p className="text-xs uppercase tracking-wider text-zinc-500">Volunteer hours saved</p>
      <p className={`mt-1 font-black text-emerald-300 ${big ? "text-5xl" : "text-3xl"}`}>
        {hours.toFixed(1)}
        <span className="ml-1 text-base font-semibold text-emerald-400/70">h</span>
      </p>
      <p className="text-xs text-zinc-500">
        {lines.length ? `${lines.length} jobs done by Grokbot` : "Nothing approved yet"} · a full kit saves ~{KIT_POTENTIAL_HOURS}h
      </p>
      {big && lines.length > 0 && (
        <details className="mt-2 text-xs text-zinc-400">
          <summary className="cursor-pointer text-zinc-300">Breakdown</summary>
          <ul className="mt-1 space-y-0.5">
            {lines.map((l) => (
              <li key={l.label} className="flex justify-between gap-4">
                <span>{l.label}</span>
                <span className="text-zinc-500">{l.minutes} min</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

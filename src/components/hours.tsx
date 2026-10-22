import type { DB } from "@/lib/types";
import { hoursSaved, KIT_POTENTIAL_HOURS } from "@/lib/hours";
import { Mascot } from "./ui";

/** The headline number: volunteer hours saved, with the per-piece breakdown on hover and on expand. */
export function HoursSaved({ db, eventId, big }: { db: DB; eventId: string; big?: boolean }) {
  const { hours, lines } = hoursSaved(db, eventId);
  const breakdown = lines.map((l) => `${l.label}: ${l.minutes} min`).join("\n");
  return (
    <div
      className={big ? "relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-soft p-5 text-white shadow-[0_20px_40px_-20px_rgba(12,31,77,0.7)]" : "card p-4"}
      title={breakdown || "Approve pieces to start saving time"}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${big ? "text-white/60" : "text-muted"}`}>Volunteer hours saved</p>
      <p className={`mt-1 font-extrabold tracking-tight ${big ? "text-6xl text-glow" : "text-3xl text-glow-deep"}`}>
        {hours.toFixed(1)}
        <span className="ml-1 text-base font-semibold opacity-70">h</span>
      </p>
      <p className={`text-xs ${big ? "text-white/60" : "text-muted"}`}>
        {lines.length ? `${lines.length} jobs done by Grok` : "Nothing approved yet"} · full kit ≈ {KIT_POTENTIAL_HOURS}h
      </p>
      {big && <Mascot pose="walk" className="pointer-events-none absolute -bottom-3 -right-4 w-32 opacity-95" />}
      {big && lines.length > 0 && (
        <details className="relative z-10 mt-3 text-xs text-white/70">
          <summary className="cursor-pointer font-semibold text-white">Breakdown</summary>
          <ul className="mt-2 space-y-1">
            {lines.map((l) => (
              <li key={l.label} className="flex justify-between gap-4">
                <span>{l.label}</span>
                <span className="text-white/50">{l.minutes} min</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

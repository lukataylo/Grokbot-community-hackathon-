import type { Attendee, Platform } from "@/lib/types";

export function Avatar({ a, size = 36 }: { a: Pick<Attendee, "name" | "color">; size?: number }) {
  const initials = a.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-black/40"
      style={{ width: size, height: size, background: a.color, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.7L6.4 3.9H4.6L17.7 20Z" />
    </svg>
  );
}

export function LinkedInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4V9Z" />
    </svg>
  );
}

export function PlatformIcon({ p, className }: { p: Platform; className?: string }) {
  return p === "x" ? <XIcon className={className} /> : <LinkedInIcon className={className} />;
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "amber" | "fuchsia" | "red" | "sky" }) {
  const tones = {
    zinc: "bg-white/10 text-zinc-200",
    green: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    fuchsia: "bg-fuchsia-500/15 text-fuchsia-300",
    red: "bg-rose-500/15 text-rose-300",
    sky: "bg-sky-500/15 text-sky-300",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function GrokMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M5 19 19 5M9 5h10v10M5 9v10h10" />
    </svg>
  );
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function relTime(iso: string) {
  const d = (new Date(iso).getTime() - Date.now()) / 60000;
  if (Math.abs(d) < 1) return "now";
  const m = Math.round(Math.abs(d));
  const s = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  return d > 0 ? `in ${s}` : `${s} ago`;
}

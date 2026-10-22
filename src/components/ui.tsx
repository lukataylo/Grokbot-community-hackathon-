import type { Attendee, Platform } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function Logo({ className = "text-2xl", light }: { className?: string; light?: boolean }) {
  return <span className={`font-extrabold tracking-tight ${light ? "text-white" : "text-navy"} ${className}`}>afterglow</span>;
}

export function Mascot({ pose = "wave", className = "" }: { pose?: "wave" | "peek" | "walk"; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${BASE}/brand/mascot-${pose}.png`} alt="" className={`pointer-events-none select-none drop-shadow-[0_18px_22px_rgba(14,29,79,0.25)] ${className}`} />;
}

export function Avatar({ a, size = 36 }: { a: Pick<Attendee, "name" | "color" | "avatarUrl">; size?: number }) {
  const initials = a.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  if (a.avatarUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={a.avatarUrl.startsWith("/") ? `${BASE}${a.avatarUrl}` : a.avatarUrl} alt={a.name} width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />
    );
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white"
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
    zinc: "bg-ice text-ink",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    fuchsia: "bg-sky-soft text-navy",
    red: "bg-rose-50 text-rose-700",
    sky: "bg-sky-soft text-[#0a66c2]",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function GrokMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1" />
    </svg>
  );
}

export function PhotosIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5" />
    </svg>
  );
}

export function TrophyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z" />
    </svg>
  );
}

export function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z" />
      <path d="M19 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />
    </svg>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-ice p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${value === o.value ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
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

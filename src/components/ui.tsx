import type { Attendee, Platform } from "@/lib/types";

export function Avatar({ a, size = 36 }: { a: Pick<Attendee, "name" | "color">; size?: number }) {
  const initials = a.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white shadow-sm"
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
    zinc: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    fuchsia: "bg-glow-soft text-navy ring-1 ring-glow/40",
    red: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    sky: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
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

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function Wordmark({ className = "text-2xl", light }: { className?: string; light?: boolean }) {
  return <span className={`font-extrabold tracking-[-0.04em] ${light ? "text-white" : "text-navy"} ${className}`}>afterglow</span>;
}

/** The afterglow camera mascot. */
export function Mascot({ pose = "hero", className = "" }: { pose?: "hero" | "wave" | "walk"; className?: string }) {
  const file = { hero: "mascot", wave: "mascot-wave", walk: "mascot-walk" }[pose];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${BASE_PATH}/${file}.webp`} alt="" aria-hidden className={`select-none drop-shadow-[0_18px_24px_rgba(12,31,77,0.25)] ${className}`} />;
}

const icon = (d: React.ReactNode) =>
  function Icon({ className = "h-5 w-5" }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {d}
      </svg>
    );
  };

export const PhotoIcon = icon(<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>);
export const TrophyIcon = icon(<><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M16 6h3a3 3 0 0 1-3 4M8 6H5a3 3 0 0 0 3 4M12 13v4M8 20h8M10 17h4" /></>);
export const SparkleIcon = icon(<><path d="M12 3c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6Z" /><path d="M19 15c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" /></>);
export const ScanIcon = icon(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><rect x="8" y="8" width="8" height="8" rx="1.5" /></>);
export const MailIcon = icon(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>);
export const LinkIcon = icon(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const AtIcon = icon(<><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" /></>);
export const EyeIcon = icon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const UserIcon = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const ArrowRight = icon(<path d="M5 12h14M13 6l6 6-6 6" />);
export const ChevronRight = icon(<path d="m9 6 6 6-6 6" />);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const ChartIcon = icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const ExternalIcon = icon(<path d="M7 17 17 7M9 7h8v8" />);
export const CheckIcon = icon(<path d="m5 12 5 5 9-10" />);

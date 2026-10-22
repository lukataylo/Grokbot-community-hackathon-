"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { dayLabel, nowNext, timeLabel } from "@/lib/kit";
import type { Attendee, EventKit } from "@/lib/types";
import { ArrowRight, AtIcon, CheckIcon, EyeIcon, LinkIcon, MailIcon, UserIcon } from "./ui";

export function ActionButton({ run, label, busyLabel, className = "btn-grok" }: { run: () => Promise<unknown>; label: React.ReactNode; busyLabel?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await run();
        setBusy(false);
      }}
    >
      {busy ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> {busyLabel ?? "Working…"}
        </>
      ) : (
        label
      )}
    </button>
  );
}

export function JoinForm({ eventId, initial }: { eventId: string; initial?: Partial<Attendee> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    xHandle: initial?.xHandle ?? "",
    linkedin: initial?.linkedin ?? "",
    lookFor: initial?.lookFor ?? "",
    consentPhoto: initial?.consentPhoto ?? false,
    consentTag: initial?.consentTag ?? false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const a = await api.join({ eventId, ...f });
        setBusy(false);
        if (a) router.push(`/e/${eventId}`);
      }}
    >
      <Field label="Your name" icon={<UserIcon className="h-5 w-5" />}>
        <input className="input pl-12" required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
      </Field>
      <Field label="Email" icon={<MailIcon className="h-5 w-5" />}>
        <input className="input pl-12" type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="X handle" icon={<AtIcon className="h-5 w-5" />}>
          <input className="input pl-12" required value={f.xHandle} onChange={(e) => set("xHandle", e.target.value)} placeholder="ada" />
        </Field>
        <Field label="LinkedIn" icon={<LinkIcon className="h-5 w-5" />}>
          <input className="input pl-12" value={f.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="in/yourname" />
        </Field>
      </div>
      <Field label="How will Grok spot you tonight?" icon={<EyeIcon className="h-5 w-5" />} hint="A description instead of face biometrics. Only used to find you in photos.">
        <input className="input pl-12" value={f.lookFor} onChange={(e) => set("lookFor", e.target.value)} placeholder="e.g. orange hoodie, glasses" />
      </Field>
      <div className="space-y-3 pt-1">
        <Check label="I'm happy to be photographed" sub="If not, photos you're in are blurred or hidden." on={f.consentPhoto} set={(v) => setF((p) => ({ ...p, consentPhoto: v, consentTag: v && p.consentTag }))} />
        <Check label="People can tag me in posts" sub="Grok tags you and sends you your photos." on={f.consentPhoto && f.consentTag} disabled={!f.consentPhoto} set={(v) => set("consentTag", v)} />
      </div>
      <button className="btn-primary w-full py-4 text-base" disabled={busy}>
        {busy ? "Joining…" : initial?.xHandle ? "Save preferences" : "Join event"} <ArrowRight className="h-5 w-5" />
      </button>
      <p className="text-center text-xs text-muted">Change your preferences anytime.</p>
    </form>
  );
}

function Field({ label, icon, hint, children }: { label: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
        {children}
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Check({ label, sub, on, set, disabled }: { label: string; sub: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => set(!on)} className="flex w-full items-start gap-3 text-left disabled:opacity-40">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition ${on ? "border-navy bg-navy text-white" : "border-slate-300 bg-white"}`}>
        {on && <CheckIcon className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </button>
  );
}

export function BotConsole({ eventId }: { eventId: string }) {
  const [log, setLog] = useState<{ who: "you" | "bot"; text: string }[]>([
    { who: "bot", text: "Hi, I'm Grok, your co-organiser. Try /stats, /tag, /plan, /nudge, /winners, /announce <msg>, or just ask me something." },
  ]);
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [log]);

  async function send(c: string) {
    if (!c.trim()) return;
    setLog((l) => [...l, { who: "you", text: c }]);
    setCmd("");
    setBusy(true);
    const reply = await api.bot(eventId, c);
    setLog((l) => [...l, { who: "bot", text: reply }]);
    setBusy(false);
  }

  return (
    <div className="card flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Grok console</h3>
        <div className="flex gap-1">
          {["/stats", "/nudge", "/winners"].map((c) => (
            <button key={c} className="rounded-md bg-mist px-2 py-0.5 font-mono text-xs text-navy/80 hover:bg-glow-soft" onClick={() => send(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm" style={{ maxHeight: 280 }}>
        {log.map((m, i) => (
          <div key={i} className={m.who === "you" ? "text-right" : ""}>
            <span className={`inline-block whitespace-pre-wrap rounded-xl px-3 py-2 ${m.who === "you" ? "bg-navy text-white" : "bg-glow-soft text-navy"}`}>{m.text}</span>
          </div>
        ))}
        {busy && <div className="text-xs text-muted">Grok is thinking…</div>}
        <div ref={end} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(cmd);
        }}
      >
        <input className="input font-mono" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="/announce Demos start in 10 min!" />
        <button className="btn-primary">Send</button>
      </form>
    </div>
  );
}

/** Night-of helper: what's on now and next from the run sheet, and last-minute changes pushed to the group. */
export function NightOf({ eventId, kit }: { eventId: string; kit?: EventKit }) {
  const [change, setChange] = useState("");
  const [sent, setSent] = useState<{ text: string; via: string } | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const { now, next } = nowNext(kit, tick);
  return (
    <div className="card grid gap-4 p-4 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <h3 className="mb-2 font-semibold">Run sheet{kit ? ` · ${kit.facts.name}` : ""}</h3>
        {kit ? (
          <div className="space-y-2 text-sm">
            <div className="rounded-xl bg-glow-soft p-3">
              <p className="text-xs uppercase tracking-wider text-glow-deep">Now</p>
              <p className="font-semibold">{now ? `${timeLabel(now.time)} · ${now.item}` : "Not started yet"}</p>
              {now && <p className="text-xs text-muted">{now.owner}{now.notes ? ` · ${now.notes}` : ""}</p>}
            </div>
            <div className="rounded-xl bg-mist p-3">
              <p className="text-xs uppercase tracking-wider text-muted">Next</p>
              <p className="font-semibold">{next ? `${now ? "" : `${dayLabel(next.time)}, `}${timeLabel(next.time)} · ${next.item}` : "That's a wrap"}</p>
              {next && <p className="text-xs text-muted">{next.owner}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No run sheet yet. <Link href={`/organiser/${eventId}/autopilot`} className="text-glow-deep hover:underline">Generate one with Autopilot</Link>.
          </p>
        )}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!change.trim()) return;
          setSent(await api.announce(eventId, change));
          setChange("");
        }}
      >
        <h3 className="font-semibold">Push a last-minute change</h3>
        <textarea className="input h-20" value={change} onChange={(e) => setChange(e.target.value)} placeholder="Demos moved to 21:45, pizza is in the kitchen not the hall" />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-grok">📣 Write & push</button>
          {sent && (
            <a href={`https://wa.me/?text=${encodeURIComponent(sent.text)}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1 text-xs">
              Open WhatsApp ↗
            </a>
          )}
        </div>
        {sent && (
          <p className="rounded-lg bg-mist px-3 py-2 text-sm text-navy">
            {sent.text} <span className="text-xs text-muted">· {sent.via}</span>
          </p>
        )}
      </form>
    </div>
  );
}

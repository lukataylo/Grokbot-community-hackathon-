"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { dayLabel, nowNext, timeLabel } from "@/lib/kit";
import type { Attendee, EventKit } from "@/lib/types";

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

export function SignInAs({ attendees, currentId, redirect }: { attendees: Pick<Attendee, "id" | "name" | "xHandle">[]; currentId?: string; redirect?: string }) {
  const router = useRouter();
  return (
    <select
      className="rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-xs text-zinc-300"
      value={currentId ?? ""}
      onChange={async (e) => {
        await api.login(e.target.value || null);
        if (redirect) router.push(redirect);
      }}
    >
      <option value="">Demo: sign in as…</option>
      {attendees.map((a) => (
        <option key={a.id} value={a.id}>
          @{a.xHandle} ({a.name})
        </option>
      ))}
    </select>
  );
}

export function UploadForm() {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    await api.upload(Array.from(files), caption || "Event moment");
    setBusy(false);
    setCaption("");
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload(e.dataTransfer.files);
      }}
      className={`card flex flex-col gap-3 border-dashed p-5 sm:flex-row sm:items-center ${drag ? "border-fuchsia-400 bg-fuchsia-500/10" : ""}`}
    >
      <div className="flex-1">
        <p className="font-semibold">Upload your event photos</p>
        <p className="text-sm text-zinc-400">Grok finds the people who opted in, tags them and delivers the photo to them. Anyone who opted out is never tagged.</p>
      </div>
      <input className="input sm:w-56" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <button className="btn-grok" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Grok is tagging…" : "Upload photos"}
      </button>
    </div>
  );
}

export function JoinForm({ eventId, initial }: { eventId: string; initial?: Partial<Attendee> }) {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "profile">(initial?.xHandle ? "profile" : "login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    xHandle: initial?.xHandle ?? "",
    linkedin: initial?.linkedin ?? "",
    lookFor: initial?.lookFor ?? "",
    consentPhoto: initial?.consentPhoto ?? true,
    consentTag: initial?.consentTag ?? true,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  if (step === "login")
    return (
      <div className="space-y-3">
        <button className="btn w-full bg-black py-3 text-white ring-1 ring-white/20 hover:bg-zinc-900" onClick={() => setStep("profile")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Z" /></svg>
          Continue with X
        </button>
        <p className="text-center text-xs text-zinc-500">We only read your public handle. Nothing is posted without your approval.</p>
      </div>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const a = await api.join({ eventId, ...f });
        setBusy(false);
        if (a) router.push(`/e/${eventId}/me`);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-sm">
          Name
          <input className="input mt-1" required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ada Lovelace" />
        </label>
        <label className="text-sm">
          X handle
          <input className="input mt-1" required value={f.xHandle} onChange={(e) => set("xHandle", e.target.value)} placeholder="@ada" />
        </label>
        <label className="text-sm">
          LinkedIn
          <input className="input mt-1" value={f.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/in/ada" />
        </label>
        <label className="col-span-2 text-sm">
          How will Grok spot you tonight?
          <input className="input mt-1" value={f.lookFor} onChange={(e) => set("lookFor", e.target.value)} placeholder="e.g. orange hoodie, glasses" />
          <span className="mt-1 block text-xs text-zinc-500">A description instead of face biometrics. Delete it any time.</span>
        </label>
      </div>
      <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
        <Toggle label="I'm happy to appear in event photos" sub="If off, photos you appear in are hidden from the shared gallery" on={f.consentPhoto} set={(v) => set("consentPhoto", v)} />
        <Toggle label="Tag me and send me my photos" sub="Grok tags you and adds you to the sharing plan" on={f.consentPhoto && f.consentTag} disabled={!f.consentPhoto} set={(v) => set("consentTag", v)} />
      </div>
      <button className="btn-grok w-full py-3" disabled={busy}>
        {busy ? "Joining…" : "Join the event"}
      </button>
    </form>
  );
}

function Toggle({ label, sub, on, set, disabled }: { label: string; sub: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => set(!on)} className="flex w-full items-center gap-3 text-left disabled:opacity-40">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-fuchsia-500" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-5" : "left-0.5"}`} />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-zinc-500">{sub}</span>
      </span>
    </button>
  );
}

export function BotConsole({ eventId }: { eventId: string }) {
  const [log, setLog] = useState<{ who: "you" | "bot"; text: string }[]>([
    { who: "bot", text: "Hi, I'm Grokbot. Try /stats, /tag, /plan, /nudge, /winners, /announce <msg>, or just ask me something." },
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
        <h3 className="font-semibold">Grokbot console</h3>
        <div className="flex gap-1">
          {["/stats", "/nudge", "/winners"].map((c) => (
            <button key={c} className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-xs text-zinc-300 hover:bg-white/10" onClick={() => send(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm" style={{ maxHeight: 280 }}>
        {log.map((m, i) => (
          <div key={i} className={m.who === "you" ? "text-right" : ""}>
            <span className={`inline-block whitespace-pre-wrap rounded-xl px-3 py-2 ${m.who === "you" ? "bg-white text-black" : "bg-fuchsia-500/15 text-fuchsia-100"}`}>{m.text}</span>
          </div>
        ))}
        {busy && <div className="text-xs text-zinc-500">Grokbot is thinking…</div>}
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
            <div className="rounded-xl bg-fuchsia-500/10 p-3">
              <p className="text-xs uppercase tracking-wider text-fuchsia-300">Now</p>
              <p className="font-semibold">{now ? `${timeLabel(now.time)} · ${now.item}` : "Not started yet"}</p>
              {now && <p className="text-xs text-zinc-400">{now.owner}{now.notes ? ` · ${now.notes}` : ""}</p>}
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Next</p>
              <p className="font-semibold">{next ? `${now ? "" : `${dayLabel(next.time)}, `}${timeLabel(next.time)} · ${next.item}` : "That's a wrap"}</p>
              {next && <p className="text-xs text-zinc-400">{next.owner}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            No run sheet yet. <Link href={`/organiser/${eventId}/autopilot`} className="text-fuchsia-300 hover:underline">Generate one with Autopilot</Link>.
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
          <p className="rounded-lg bg-black/40 px-3 py-2 text-sm text-zinc-200">
            {sent.text} <span className="text-xs text-zinc-500">· {sent.via}</span>
          </p>
        )}
      </form>
    </div>
  );
}

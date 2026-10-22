"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Attendee } from "@/lib/types";
import { Mascot } from "./ui";

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
      className="w-full rounded-xl border border-line bg-ice px-3 py-2 text-sm text-navy"
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

export function UploadButton() {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    await api.upload(Array.from(files), files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") : "Event moments");
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <button className="btn-grok w-full py-4 text-base" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" /> Grok is tagging…
          </>
        ) : (
          <>
            <span className="text-xl leading-none">+</span> Upload photos
          </>
        )}
      </button>
    </div>
  );
}

function FieldIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-navy">{label}</span>
      <span className="flex items-center gap-2 rounded-2xl border border-line bg-ice px-4 focus-within:border-sky focus-within:bg-white">
        <FieldIcon d={icon} />
        {children}
      </span>
    </label>
  );
}

const fieldInput = "w-full bg-transparent py-3 text-sm text-navy outline-none placeholder:text-muted/70";

export function JoinForm({ eventId, initial }: { eventId: string; initial?: Partial<Attendee> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [f, setF] = useState({
    email: initial?.email ?? "",
    linkedin: initial?.linkedin ?? "",
    xHandle: initial?.xHandle ?? "",
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
      <Field label="Email" icon="M3 6h18v12H3zM3 7l9 6 9-6">
        <input className={fieldInput} type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
      </Field>
      <Field label="LinkedIn profile URL" icon="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1">
        <input className={fieldInput} value={f.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/in/yourname" />
      </Field>
      {more ? (
        <>
          <Field label="X handle" icon="M4 4l16 16M20 4 4 20">
            <input className={fieldInput} value={f.xHandle} onChange={(e) => set("xHandle", e.target.value)} placeholder="@yourhandle" />
          </Field>
          <Field label="How will Grok spot you tonight?" icon="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z">
            <input className={fieldInput} value={f.lookFor} onChange={(e) => set("lookFor", e.target.value)} placeholder="e.g. orange hoodie, glasses" />
          </Field>
        </>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-sky">
          + Add X handle and how Grok can spot you
        </button>
      )}
      <div className="space-y-3 pt-1">
        <Check label="I'm happy to be photographed" on={f.consentPhoto} set={(v) => set("consentPhoto", v)} />
        <Check label="People can tag me in posts" on={f.consentPhoto && f.consentTag} disabled={!f.consentPhoto} set={(v) => set("consentTag", v)} />
      </div>
      <button className="btn-primary w-full py-4 text-base" disabled={busy}>
        {busy ? "Joining…" : <>Join event <span aria-hidden>→</span></>}
      </button>
    </form>
  );
}

function Check({ label, on, set, disabled }: { label: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => set(!on)} className="flex w-full items-center gap-3 text-left text-sm text-ink disabled:opacity-40">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition ${on ? "border-navy bg-navy text-white" : "border-[#c9d6e8] bg-white"}`}>
        {on && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        )}
      </span>
      {label}
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
    <div className="card flex h-full flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-sky">
            <Mascot pose="peek" className="w-8 translate-y-0.5 drop-shadow-none" />
          </span>
          Grokbot
        </h3>
        <div className="flex gap-1">
          {["/stats", "/nudge", "/winners"].map((c) => (
            <button key={c} className="rounded-full bg-ice px-2.5 py-1 font-mono text-xs text-ink hover:bg-sky-soft" onClick={() => send(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm" style={{ maxHeight: 280 }}>
        {log.map((m, i) => (
          <div key={i} className={m.who === "you" ? "text-right" : ""}>
            <span className={`inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left ${m.who === "you" ? "bg-navy text-white" : "bg-ice text-navy"}`}>{m.text}</span>
          </div>
        ))}
        {busy && <div className="text-xs text-muted">Grokbot is thinking…</div>}
        <div ref={end} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(cmd);
        }}
      >
        <input className="input rounded-full font-mono" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="/announce Demos start in 10 min!" />
        <button className="btn-primary">Send</button>
      </form>
    </div>
  );
}

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
  const [caption, setCaption] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    await api.upload(Array.from(files), caption || "Event moment");
    setBusy(false);
    setCaption("");
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input className="input rounded-full text-center" placeholder="Add a caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
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
  const [step, setStep] = useState<"login" | "profile">(initial?.xHandle ? "profile" : "login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    xHandle: initial?.xHandle ?? "",
    linkedin: initial?.linkedin ?? "",
    lookFor: initial?.lookFor ?? "",
    consentPhoto: initial?.consentPhoto ?? false,
    consentTag: initial?.consentTag ?? false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  if (step === "login")
    return (
      <div className="space-y-3">
        <button className="btn-primary w-full py-4 text-base" onClick={() => setStep("profile")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Z" /></svg>
          Continue with X
        </button>
        <p className="text-center text-xs text-muted">We only read your public handle. Nothing is posted without your approval.</p>
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
        if (a) router.push(`/e/${eventId}`);
      }}
    >
      <Field label="Name" icon="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0">
        <input className={fieldInput} required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ada Lovelace" />
      </Field>
      <Field label="X handle" icon="M4 4l16 16M20 4 4 20">
        <input className={fieldInput} required value={f.xHandle} onChange={(e) => set("xHandle", e.target.value)} placeholder="@yourhandle" />
      </Field>
      <Field label="LinkedIn profile URL" icon="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1">
        <input className={fieldInput} value={f.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/in/yourname" />
      </Field>
      <Field label="How will Grok spot you tonight?" icon="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z">
        <input className={fieldInput} value={f.lookFor} onChange={(e) => set("lookFor", e.target.value)} placeholder="e.g. orange hoodie, glasses" />
      </Field>
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

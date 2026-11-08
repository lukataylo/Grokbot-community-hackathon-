"use client";
import { useRef, useState } from "react";
import { api, Icon, Logo, shrink } from "../ui";
import type { Feed } from "./types";

export function Join({ slug, feed, onDone }: { slug: string; feed: Feed; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ev = feed.event;
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api(`/api/g/${slug}/join`, { method: "POST", json: { name } }); onDone(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <form className="shell" onSubmit={go}>
      <div className="top"><Logo /></div>
      <div className="stack" style={{ marginTop: 32, gap: 10 }}>
        {ev.hostedBy && <p>{ev.hostedBy} invites you to</p>}
        <h1 style={{ fontSize: "clamp(40px, 12vw, 52px)" }}>{ev.name}</h1>
        <div className="live"><i />{feed.guests} {feed.guests === 1 ? "guest" : "guests"} here</div>
      </div>
      <div className="grow" />
      <label className="field">Your name, as you'd like to be tagged
        <input autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" />
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn" disabled={busy || !name.trim()}>{busy ? <span className="spin" /> : "Join"}</button>
      <p className="small center">No app. No account. Your photos arrive at {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ev.timezone }).format(new Date(ev.deliverAt))} tomorrow.</p>
    </form>
  );
}

export function Choose({ slug, feed, onDone, step = true }: { slug: string; feed: Feed; onDone: () => void; step?: boolean }) {
  const me = feed.me!;
  const [choice, setChoice] = useState<"show" | "cover">(me.choice ?? "show");
  const [tag, setTag] = useState(me.choice ? me.taggable : true);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await api(`/api/g/${slug}/me`, { method: "PATCH", json: { choice, taggable: choice === "show" && tag } }).catch(() => {});
    onDone();
  }
  return (
    <div className="shell">
      <div className="top"><span>{feed.event.name}</span>{step && <span>1 of 3</span>}</div>
      <h1 style={{ marginTop: 16 }}>How should you appear tonight?</h1>
      <div className="stack" style={{ marginTop: 8 }}>
        <button type="button" className="opt" aria-pressed={choice === "show"} onClick={() => setChoice("show")}>
          <span className="ico"><Icon name="person" size={26} /></span><span><b>Show me</b><small>You appear in the photos</small></span>
          <span className="radio">{choice === "show" && <Icon name="check" size={14} color="#fff" width={2.6} />}</span>
        </button>
        <button type="button" className="opt" aria-pressed={choice === "cover"} onClick={() => setChoice("cover")}>
          <span className="ico"><Icon name="cover" size={26} /></span><span><b>Cover me</b><small>Your face becomes soft tiles</small></span>
          <span className="radio">{choice === "cover" && <Icon name="check" size={14} color="#fff" width={2.6} />}</span>
        </button>
      </div>
      <label className="li" style={{ borderTop: "1px solid var(--line)", marginTop: 4 }}>
        <span>Let guests tag me in posts<small>{choice === "cover" ? "Not available when you're covered" : "Only by your name, only if you're in their photo"}</small></span>
        <input type="checkbox" className="switch" checked={choice === "show" && tag} disabled={choice === "cover"} onChange={(e) => setTag(e.target.checked)} aria-label="Let guests tag me" />
      </label>
      <div className="grow" />
      <button className="btn" onClick={save} disabled={busy}>{busy ? <span className="spin" /> : "Continue"}</button>
      <p className="small center">Change it any time. Anyone we can't match to a yes is tiled automatically.</p>
    </div>
  );
}

export function FindMe({ slug, feed, onDone, onSkip }: { slug: string; feed: Feed; onDone: () => void; onSkip: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const show = feed.me?.choice === "show";
  async function picked(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("selfie", await shrink(f, 1200), "selfie.jpg");
      await api(`/api/g/${slug}/selfie`, { method: "POST", body: fd });
      onDone();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <div className="shell">
      <div className="top"><span>{feed.event.name}</span><span>2 of 3</span></div>
      <h1 style={{ marginTop: 16 }}>One photo of you.</h1>
      <p>{show ? "So we can find you and keep you visible. Without it, you'll be tiled like everyone else." : "So we can find the photos you're in. You stay covered either way."} We keep a face pattern, never the photo, and delete it with the event.</p>
      <div className="grow" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
        <button type="button" onClick={() => input.current?.click()} aria-label="Take a selfie" style={{ width: 210, height: 260, borderRadius: 999, background: "var(--panel)", border: "2px dashed #CFCFCB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {busy ? <span className="spin" /> : <Icon name="person" size={72} color="#B4B4B0" width={1.1} />}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={(e) => picked(e.target.files?.[0])} />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn" onClick={() => input.current?.click()} disabled={busy}><Icon name="camera" size={20} />{busy ? "Checking…" : "Take photo"}</button>
      <button className="btn ghost" onClick={onSkip} disabled={busy}>Skip for now</button>
    </div>
  );
}

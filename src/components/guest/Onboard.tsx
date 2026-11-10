"use client";
import { useEffect, useRef, useState } from "react";
import { api, Icon, Logo, Rays, Steps, shrink } from "../ui";
import { ChoiceArt, TileFace } from "./art";
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
    <form className="shell ob" onSubmit={go}>
      <div className="top"><Logo />{feed.guests > 0 && <span className="live"><i />{feed.guests} here</span>}</div>
      <div className="stage join-stage">
        <Rays spin />
        <div className="join-title">
          {ev.hostedBy && <p>{ev.hostedBy} invites you to</p>}
          <h1 className={ev.name.length > 44 ? "long xl" : ev.name.length > 22 ? "long" : undefined}>{ev.name}</h1>
        </div>
        <div className="card lift join-card">
          <label className="field">Your name
            <input autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" />
          </label>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn" disabled={busy || !name.trim()}>{busy ? <span className="spin" /> : "Join"}</button>
        </div>
      </div>
      <p className="small center">No app. No account.</p>
    </form>
  );
}

export function Choose({ slug, feed, onDone, step = true }: { slug: string; feed: Feed; onDone: () => void; step?: boolean }) {
  const me = feed.me!;
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [choice, setChoice] = useState<"show" | "cover">(me.choice ?? "show");
  const [tag, setTag] = useState(me.choice ? me.taggable : true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true); setErr("");
    // Never move on if this failed: a guest who chose Cover must not believe they're covered when they aren't.
    try { await api(`/api/g/${slug}/me`, { method: "PATCH", json: { choice, taggable: choice === "show" && tag } }); onDone(); }
    catch (x) { setErr((x as Error).message || "Couldn't save. Check your connection and try again."); setBusy(false); }
  }
  return (
    <div className="shell ob">
      <Steps name={feed.event.name} n={step ? 1 : undefined} />
      <h1 className="pick-h">How should you appear tonight?</h1>
      <div className="pick" style={{ marginTop: 10 }}>
        <button type="button" className="opt tile" aria-pressed={choice === "show"} onClick={() => setChoice("show")}>
          <span className="art"><ChoiceArt kind="show" /></span>
          <span className="txt"><b>Show me</b><small>Your face shows in photos guests see, live</small></span>
          <span className="radio">{choice === "show" && <Icon name="check" size={14} color="#fff" width={2.6} />}</span>
        </button>
        <button type="button" className="opt tile" aria-pressed={choice === "cover"} onClick={() => setChoice("cover")}>
          <span className="art"><ChoiceArt kind={feed.event.faceStyle === "standins" ? "standin" : "tiles"} /></span>
          <span className="txt"><b>Cover me</b><small>{feed.event.faceStyle === "standins" ? "Your face is replaced by an AI stand-in" : "Your face becomes soft tiles"}</small></span>
          <span className="radio">{choice === "cover" && <Icon name="check" size={14} color="#fff" width={2.6} />}</span>
        </button>
      </div>
      <p className="small">Change it any time. Anyone who hasn&apos;t said yes is {feed.event.faceStyle === "standins" ? "covered by an AI stand-in" : "tiled"}.</p>
      <label className="li" style={{ borderTop: "1px solid var(--line)" }}>
        <span>Let guests tag me in posts<small>{choice === "cover" ? "Not available when you're covered" : "Only in photos you're in"}</small></span>
        <input type="checkbox" className="switch" checked={choice === "show" && tag} disabled={choice === "cover"} onChange={(e) => setTag(e.target.checked)} aria-label="Let guests tag me" />
      </label>
      <div className="grow" />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn" onClick={save} disabled={busy}>{busy ? <span className="spin" /> : "Continue"}</button>
    </div>
  );
}

export function FindMe({ slug, feed, onDone, onSkip }: { slug: string; feed: Feed; onDone: () => void; onSkip: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const show = feed.me?.choice === "show";
  useEffect(() => { window.scrollTo(0, 0); }, []);
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
    <div className="shell ob">
      <Steps name={feed.event.name} n={2} />
      <h1 className="pick-h">One photo of you.</h1>
      <p>{show ? "So you stay visible. Without it, you're tiled." : "To find your photos. You stay covered."} We keep a face pattern, not the photo, and delete it with the event.</p>
      <div className="stage selfie-stage">
        <Rays spin />
        <button type="button" className={busy ? "selfie busy" : "selfie"} onClick={() => input.current?.click()} disabled={busy} tabIndex={-1} aria-hidden="true"><TileFace /></button>
      </div>
      <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={(e) => picked(e.target.files?.[0])} />
      {err && <div className="err" role="alert">{err}</div>}
      <div className="ob-acts">
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}><Icon name="camera" size={20} />{busy ? "Checking…" : "Take photo"}</button>
        <button className="btn ghost" onClick={onSkip} disabled={busy}>Skip for now</button>
      </div>
    </div>
  );
}

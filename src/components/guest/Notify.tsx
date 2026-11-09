"use client";
import { useEffect, useState } from "react";
import { api, Burst, Icon, Rays } from "../ui";
import { platform, type Feed } from "./types";

function key(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribePush(slug: string, vapid: string) {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(vapid) }));
  await api(`/api/g/${slug}/push`, { method: "POST", json: sub.toJSON() });
}

type Step = "why" | "install" | "open" | "inapp" | "choose" | "done" | "denied" | "email";

export function Notify({ slug, feed, vapid, onDone, standaloneStart }: { slug: string; feed: Feed; vapid: string; onDone: () => void; standaloneStart?: boolean }) {
  const [p, setP] = useState(platform());
  const [step, setStep] = useState<Step>(standaloneStart ? "choose" : "why");
  const [prefs, setPrefs] = useState(feed.me!.prefs);
  const [email, setEmail] = useState(feed.me?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ev = feed.event;
  const at = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ev.timezone }).format(new Date(ev.deliverAt));
  useEffect(() => setP(platform()), []);

  function next() {
    if (p.inApp) return setStep("inapp");
    if (p.push && (p.standalone || !p.ios)) return setStep("choose");
    if (p.ios && !p.standalone) return setStep("install");
    return setStep("email"); // no web push on this browser
  }
  async function turnOn() {
    setBusy(true); setErr("");
    try {
      const perm = await Notification.requestPermission(); // first thing after the tap: iOS drops the gesture across an await
      await api(`/api/g/${slug}/me`, { method: "PATCH", json: { prefs } });
      if (perm !== "granted") { setStep("denied"); setBusy(false); return; }
      await subscribePush(slug, vapid);
      setStep("done");
    } catch (x) { setErr((x as Error).message || "Couldn't turn notifications on"); }
    setBusy(false);
  }
  async function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api(`/api/g/${slug}/me`, { method: "PATCH", json: { email } }); onDone(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  const top = <div className="top"><span>{ev.name}</span><span>3 of 3</span></div>;

  if (step === "why") return (
    <div className="shell">{top}
      <h1 style={{ marginTop: 16 }}>Want your photos?</h1>
      <div className="list" style={{ marginTop: 8, borderTop: "1.5px solid var(--ink)" }}>
        {[["clock", `Your photos, ${at} tomorrow`], ["photo", "When you're in someone's post"], ["heart", "Tonight's posts, daily for three days"]].map(([i, t]) => (
          <div key={t} className="li" style={{ justifyContent: "flex-start", gap: 14 }}><Icon name={i} size={22} />{t}</div>
        ))}
      </div>
      <div className="grow" />
      <p className="small center">Nothing else. No marketing.</p>
      <button className="btn" onClick={next}>Yes, set it up</button>
      <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>
    </div>
  );

  if (step === "inapp") return (
    <div className="shell">{top}
      <h1 style={{ marginTop: 16 }}>Open this in {p.ios ? "Safari" : "Chrome"} first.</h1>
      <p>This in-app browser can&apos;t add Lumzel to your Home Screen.</p>
      <div className="panel"><div className="step"><span className="num">1</span><span>Tap ··· or the share icon at the {p.ios ? "bottom" : "top"} of this screen</span></div>
        <div className="step"><span className="num">2</span><span>Choose Open in {p.ios ? "Safari" : "browser"}</span></div></div>
      <p className="small">Your code: <b className="ink">{feed.me?.resume}</b></p>
      <div className="grow" />
      <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>
    </div>
  );

  if (step === "install") return (
    <div className="shell">
      <div className="top"><span>iPhone</span><span>Step 1 of 2</span></div>
      <h1 style={{ marginTop: 16 }}>First, add Lumzel to your Home Screen.</h1>
      <p>iPhone only notifies Home Screen apps. Ten seconds.</p>
      <div className="stack" style={{ gap: 16, marginTop: 6 }}>
        <div className="step"><span className="num">1</span><span>Tap <span style={{ display: "inline-flex", verticalAlign: "-5px", padding: "2px 6px", borderRadius: 8, boxShadow: "0 0 0 2px var(--you)" }}><Icon name="share" size={18} /></span> Share{p.ios && /iPad/.test(navigator.userAgent) ? " at the top" : " at the bottom"} of Safari</span></div>
        <div className="step"><span className="num">2</span><span>Scroll and tap <b className="ink" style={{ fontWeight: 500 }}>Add to Home Screen</b></span></div>
        <div className="step"><span className="num">3</span><span>Tap <b className="ink" style={{ fontWeight: 500 }}>Add</b>, then open Lumzel from your Home Screen</span></div>
      </div>
      <div className="grow" />
      <div className="row panel" style={{ flexDirection: "row" }}>
        <span style={{ width: 52, height: 52, borderRadius: 2, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Burst size={34} ink="#F2F0EB" width={6} /></span>
        <span className="small">Opens straight into {ev.name}.</span>
      </div>
      <button className="btn" onClick={() => setStep("open")}>I've added it</button>
      <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>
    </div>
  );

  if (step === "open") return (
    <div className="shell" style={{ background: "#2A2A28", color: "#F2F0EB", maxWidth: "none" }}>
      <div className="grow" />
      <div style={{ alignSelf: "center", width: 96, height: 96, borderRadius: 2, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #FFB000" }}><Burst size={62} ink="#F2F0EB" width={5} /></div>
      <h1 className="center" style={{ color: "#F2F0EB" }}>Now open Lumzel from your Home Screen.</h1>
      <p className="center" style={{ color: "#C9C7C2" }}>You&apos;ll land back in {ev.name}.</p>
      <div className="grow" />
      <button className="btn alt" onClick={() => setStep("email")}>It didn't work, email me instead</button>
    </div>
  );

  if (step === "choose") return (
    <div className="shell">{top}
      <h1 style={{ marginTop: 16 }}>What should we tell you about?</h1>
      <div className="list">
        <label className="li"><span>Your morning round-up<small>{at} tomorrow</small></span><input type="checkbox" className="switch" checked disabled aria-label="Photos ready, always on" /></label>
        {ev.sharing && <>
          <label className="li"><span>You&apos;re in someone&apos;s post</span><input type="checkbox" className="switch" checked={prefs.post} onChange={(e) => setPrefs({ ...prefs, post: e.target.checked })} /></label>
          <label className="li"><span>Posts from tonight<small>Once a day</small></span><input type="checkbox" className="switch" checked={prefs.roundup} onChange={(e) => setPrefs({ ...prefs, roundup: e.target.checked })} /></label>
          <label className="li"><span>Likes on your post<small>Milestones only</small></span><input type="checkbox" className="switch" checked={prefs.likes} onChange={(e) => setPrefs({ ...prefs, likes: e.target.checked })} /></label>
        </>}
      </div>
      <div className="grow" />
      {err && <div className="err" role="alert">{err}</div>}
      <p className="small center">Your phone will ask next. Tap Allow.</p>
      <button className="btn" onClick={turnOn} disabled={busy}>{busy ? <span className="spin" /> : "Turn on notifications"}</button>
      <button className="btn ghost" onClick={() => setStep("email")}>Email me instead</button>
    </div>
  );

  if (step === "done") return (
    <div className="shell">
      <div className="grow" />
      <div className="moment" style={{ alignItems: "flex-start", textAlign: "left" }}>
        <Rays className="ink" style={{ width: 160, height: 160 }} />
        <h1>You&apos;re set. See you at {at}.</h1>
        <p>We sent a test. Change any of this in You.</p>
      </div>
      <div className="grow" />
      <button className="btn" onClick={onDone}>Back to {ev.name}</button>
    </div>
  );

  // denied or email
  return (
    <form className="shell" onSubmit={saveEmail}>{top}
      <h1 style={{ marginTop: 16 }}>{step === "denied" ? "No notifications. That's fine." : "We'll email you instead."}</h1>
      <p>One email at {at}. Nothing else.</p>
      <label className="field">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : "Email my photos"}</button>
      <button type="button" className="btn ghost" onClick={onDone}>Skip, I'll check back</button>
      <div className="grow" />
      {step === "denied" && <div className="panel"><h3>Changed your mind?</h3><p className="small">{p.ios ? "Settings › Notifications › lumzel › Allow." : "Lock icon by the address › Notifications › Allow."}</p></div>}
    </form>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api, Burst, Icon } from "../ui";
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
      <h1 style={{ marginTop: 16 }}>Want your photos the moment they're ready?</h1>
      <div className="stack" style={{ gap: 16, marginTop: 8 }}>
        {[["clock", `Your photos, at ${at}`, "Once, tomorrow morning"], ["photo", "When someone posts a photo you're in", "So you can see it, and like it"], ["heart", "Posts from tonight's guests", "One round-up a day, for three days"]].map(([i, t, s]) => (
          <div key={t} className="step"><span className="ico" style={{ width: 42, height: 42, borderRadius: 12 }}><Icon name={i} size={20} /></span><span>{t}<small>{s}</small></span></div>
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
      <p>You're inside another app's browser, which can't keep Lumzel on your Home Screen.</p>
      <div className="panel"><div className="step"><span className="num">1</span><span>Tap ··· or the share icon at the {p.ios ? "bottom" : "top"} of this screen</span></div>
        <div className="step"><span className="num">2</span><span>Choose Open in {p.ios ? "Safari" : "browser"}</span></div></div>
      <p className="small">You'll stay signed in with your code: <b className="ink">{feed.me?.resume}</b></p>
      <div className="grow" />
      <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>
    </div>
  );

  if (step === "install") return (
    <div className="shell">
      <div className="top"><span>iPhone</span><span>Step 1 of 2</span></div>
      <h1 style={{ marginTop: 16 }}>First, add Lumzel to your Home Screen.</h1>
      <p>iPhone only sends notifications to apps on your Home Screen. It takes ten seconds.</p>
      <div className="stack" style={{ gap: 16, marginTop: 6 }}>
        <div className="step"><span className="num">1</span><span>Tap <span style={{ display: "inline-flex", verticalAlign: "-5px", padding: "2px 6px", borderRadius: 8, boxShadow: "0 0 0 2px var(--you)" }}><Icon name="share" size={18} /></span> Share{p.ios && /iPad/.test(navigator.userAgent) ? " at the top" : " at the bottom"} of Safari</span></div>
        <div className="step"><span className="num">2</span><span>Scroll and tap <b className="ink" style={{ fontWeight: 500 }}>Add to Home Screen</b></span></div>
        <div className="step"><span className="num">3</span><span>Tap <b className="ink" style={{ fontWeight: 500 }}>Add</b>, then open Lumzel from your Home Screen</span></div>
      </div>
      <div className="grow" />
      <div className="row panel" style={{ flexDirection: "row" }}>
        <span style={{ width: 52, height: 52, borderRadius: 12, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Burst size={34} ink="#F2F0EB" width={9} /></span>
        <span className="small">Your icon opens straight into {ev.name}. You stay signed in.</span>
      </div>
      <button className="btn" onClick={() => setStep("open")}>I've added it</button>
      <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>
    </div>
  );

  if (step === "open") return (
    <div className="shell" style={{ background: "#2A2A28", color: "#F2F0EB", maxWidth: "none" }}>
      <div className="grow" />
      <div style={{ alignSelf: "center", width: 96, height: 96, borderRadius: 22, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #FFB000" }}><Burst size={62} ink="#F2F0EB" width={9} /></div>
      <h1 className="center" style={{ color: "#F2F0EB" }}>Now open Lumzel from your Home Screen.</h1>
      <p className="center" style={{ color: "#C9C7C2" }}>You'll land straight back in {ev.name} to turn notifications on.</p>
      <div className="grow" />
      <button className="btn alt" onClick={() => setStep("email")}>It didn't work, email me instead</button>
    </div>
  );

  if (step === "choose") return (
    <div className="shell">{top}
      <h1 style={{ marginTop: 16 }}>What should we tell you about?</h1>
      <div className="list">
        <label className="li"><span>Your photos are ready<small>{at} tomorrow. Always on.</small></span><input type="checkbox" className="switch" checked disabled aria-label="Photos ready, always on" /></label>
        {ev.sharing && <>
          <label className="li"><span>You're in someone's post<small>When a guest posts a photo of you</small></span><input type="checkbox" className="switch" checked={prefs.post} onChange={(e) => setPrefs({ ...prefs, post: e.target.checked })} /></label>
          <label className="li"><span>Posts from tonight<small>A daily round-up you can like</small></span><input type="checkbox" className="switch" checked={prefs.roundup} onChange={(e) => setPrefs({ ...prefs, roundup: e.target.checked })} /></label>
          <label className="li"><span>Likes on your post<small>A few milestones, not every like</small></span><input type="checkbox" className="switch" checked={prefs.likes} onChange={(e) => setPrefs({ ...prefs, likes: e.target.checked })} /></label>
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
      <span style={{ width: 56, height: 56, borderRadius: 999, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={26} color="#fff" width={2.4} /></span>
      <h1>You're set. See you at {at}.</h1>
      <p>We just sent a test so you know it works. Change any of this in You.</p>
      <div className="grow" />
      <button className="btn" onClick={onDone}>Back to {ev.name}</button>
    </div>
  );

  // denied or email
  return (
    <form className="shell" onSubmit={saveEmail}>{top}
      <h1 style={{ marginTop: 16 }}>{step === "denied" ? "No notifications. That's fine." : "We'll email you instead."}</h1>
      <p>Your photos arrive by email at {at}. One email, plus nothing else.</p>
      <label className="field">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : "Email my photos"}</button>
      <button type="button" className="btn ghost" onClick={onDone}>Skip, I'll check back</button>
      <div className="grow" />
      {step === "denied" && <div className="panel"><h3>Changed your mind?</h3><p className="small">{p.ios ? "Settings › Notifications › lumzel › Allow Notifications." : "Tap the lock icon by the address, then Notifications › Allow."} We can't ask again for you.</p></div>}
    </form>
  );
}

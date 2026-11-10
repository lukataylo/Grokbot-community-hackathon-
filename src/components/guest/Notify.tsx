"use client";
import { useEffect, useState } from "react";
import { api, Burst, Icon, Rays, Steps } from "../ui";
import { fmtTime, platform, type Feed } from "./types";

function key(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribePush(slug: string, vapid: string) {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(vapid) }));
  const r = await api<{ test?: boolean }>(`/api/g/${slug}/push`, { method: "POST", json: sub.toJSON() });
  return !!r.test;
}

type Step = "why" | "install" | "open" | "inapp" | "choose" | "done" | "denied" | "email";

/**
 * When the photos arrive, in the event's own time. The host can pick any hour or send early, so the day word
 * and the jokes are worked out from the real time: nothing on these screens may promise a morning that isn't one.
 */
const ymd = (x: Date, tz: string) => Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(x));
const weekdayOf = (x: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: tz }).format(x);
/** `far` is a guest whose phone is in another time zone: the event's "tomorrow" and "breakfast" may not be theirs, so they get the weekday. */
function arrival(ev: Feed["event"], far: boolean) {
  const tz = ev.timezone, d = new Date(ev.deliverAt), at = fmtTime(ev.deliverAt, tz);
  const days = Math.round((ymd(d, tz) - ymd(new Date(), tz)) / 86_400_000);
  const weekday = weekdayOf(d, tz);
  const date = (month: "long" | "short") => new Intl.DateTimeFormat("en-GB", { day: "numeric", month, timeZone: tz }).format(d);
  // More than a week out, a weekday alone could mean the wrong week.
  const day = days > 6 ? `on ${weekday} ${date("long")}` : far || days > 1 ? `on ${weekday}` : days <= 0 ? "today" : "tomorrow";
  const h = Number(at.slice(0, 2));
  const [by, quip] = h < 5 ? ["morning", "Waiting when you wake up."] : h < 11 ? ["breakfast", "Before the coffee kicks in."] : h < 14 ? ["lunch", "Lunch just got better."]
    : h < 18 ? ["teatime", "Goes well with a biscuit."] : ["bedtime", "One last scroll before bed."];
  return { at, day, days, when: `${day} at ${at}`, by: days > 6 ? date("short") : far || days > 1 ? weekday : by, quip: far ? "Wherever you are by then." : quip, morning: !far && h >= 5 && h < 11 && days === 1 };
}
/** The round-up promise, cut to what can still be sent. Null when no round-up can go out any more. */
export function roundupLine(ev: Feed["event"]) {
  const r = ev.roundups;
  if (!r) return null;
  if (!r.until) return "One round-up a day, for three days.";
  const last = new Date(r.until), today = ymd(last, ev.timezone) === ymd(new Date(), ev.timezone);
  if (r.left === 1 || today) return `One more round-up${today ? " today" : ` by ${weekdayOf(last, ev.timezone)}`}, if there's news.`;
  return `One round-up a day, until ${weekdayOf(last, ev.timezone)}.`;
}

export function Notify({ slug, feed, vapid, onDone, standaloneStart }: { slug: string; feed: Feed; vapid: string; onDone: () => void; standaloneStart?: boolean }) {
  const [p, setP] = useState(platform());
  const [step, setStep] = useState<Step>(standaloneStart ? "choose" : "why");
  const [prefs, setPrefs] = useState(feed.me!.prefs);
  const [email, setEmail] = useState(feed.me?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tested, setTested] = useState(false);
  const ev = feed.event;
  // The time is the event's. Say which zone only to someone whose phone is on a different one.
  const [zone, setZone] = useState("");
  const w = arrival(ev, !!zone), at = w.at, round = roundupLine(ev);
  useEffect(() => {
    try {
      if (fmtTime(ev.deliverAt, Intl.DateTimeFormat().resolvedOptions().timeZone) === fmtTime(ev.deliverAt, ev.timezone)) return setZone("");
      setZone(new Intl.DateTimeFormat("en-GB", { timeZoneName: "short", timeZone: ev.timezone }).formatToParts(new Date(ev.deliverAt)).find((x) => x.type === "timeZoneName")?.value ?? "");
    } catch { /* keep the bare time */ }
  }, [ev.deliverAt, ev.timezone]);
  // Someone who joins after the photos went out gets no "they're ready" message, by push or by email.
  const email1 = () => (ev.delivered ? onDone() : setStep("email"));
  useEffect(() => setP(platform()), []);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  function next() {
    if (p.inApp) return setStep("inapp");
    if (p.push && (p.standalone || !p.ios)) return setStep("choose");
    if (p.ios && !p.standalone) return setStep("install");
    return email1(); // no web push on this browser
  }
  async function turnOn() {
    setBusy(true); setErr("");
    try {
      const perm = await Notification.requestPermission(); // first thing after the tap: iOS drops the gesture across an await
      await api(`/api/g/${slug}/me`, { method: "PATCH", json: { prefs } });
      if (perm !== "granted") { setStep("denied"); setBusy(false); return; }
      setTested(await subscribePush(slug, vapid));
      setStep("done");
    } catch (x) { setErr((x as Error).message || "Couldn't turn notifications on"); }
    setBusy(false);
  }
  async function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api(`/api/g/${slug}/me`, { method: "PATCH", json: { email } }); onDone(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  const top = <Steps name={ev.name} n={3} />;

  if (ev.delivered && !ev.sharing) return (
    <div className="shell">{top}
      <h1 style={{ marginTop: 16 }}>Your photos are in.</h1>
      <p>They&apos;re ready now, so there&apos;s nothing left to tell you about.</p>
      <div className="grow" />
      <button className="btn" onClick={onDone}>See them</button>
    </div>
  );

  // With sharing on, the pitch is what a post gets you. The cards are every kind of notification we send, drawn as a lock screen.
  if (step === "why" && ev.sharing) return (
    <div className="shell ob">{top}
      <h1 className="fame-h">{ev.delivered ? "Now get famous." : `Famous by ${w.by}.`}</h1>
      <div className="fame">
        <p className="gain">{["Likes", "Followers", "Reach"].map((x) => <span key={x}>{x}<Icon name="ext" size={18} width={2} /></span>)}</p>
        <div className="stage fame-stage">
          <Rays spin />
          <ul className="notes">
            {!ev.delivered && <li className="note"><span className="ic"><Burst size={24} ink="#fff" width={9} /></span>
              <span><b>Your photos<span className="vh">, {w.when}{zone && ` ${zone}`}.</span></b><small>{w.quip}</small></span>
              <span className="at" aria-hidden="true"><i>{w.day}{zone && ` · ${zone}`}</i>{at}</span></li>}
            <li className="note you"><span className="ic"><Icon name="heart" size={20} color="#fff" /></span><span><b>When you&apos;re in someone&apos;s post</b><small>Give it a like. It&apos;s only polite.</small></span></li>
            {round && <li className="note"><span className="ic"><Icon name="bars" size={20} color="#fff" /></span><span><b>{!ev.delivered ? "Tonight’s posts, daily" : /^One more/.test(round) ? "New posts" : "New posts, daily"}</b><small>{round}</small></span></li>}
            <li className="note"><span className="ic"><Icon name="ext" size={20} color="#fff" width={2} /></span><span><b>Likes on your post</b><small>Milestones only. We&apos;re not needy.</small></span></li>
          </ul>
          <p className="only"><span>A test first. Nothing else. No marketing.</span></p>
        </div>
      </div>
      <div className="ob-acts">
        <button className="btn" onClick={next}>Yes, set it up</button>
        {ev.delivered ? <button className="btn ghost" onClick={onDone}>Not now</button> : <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>}
      </div>
    </div>
  );

  // Without sharing there is one notification, so the screen is that one notification: a lock screen at the time it lands.
  if (step === "why") return (
    <div className="shell ob">{top}
      <h1 className="fame-h">{w.morning ? "Wake up to your photos." : "Your photos, delivered."}</h1>
      <div className="fame">
        <div className="stage fame-stage lock">
          <Rays spin />
          <p className="vh">One notification, {w.when}{zone && ` ${zone}`}: your photos are ready.</p>
          <div className="lock-clock" aria-hidden="true">
            <p className="lock-day"><span>{w.day.replace(/^on /, "").replace(/^./, (c) => c.toUpperCase())}{zone && ` · ${zone}`}</span></p>
            <p className="lock-time">{at}</p>
          </div>
          <div className="lock-foot">
            <div className="note you" aria-hidden="true"><span className="ic"><Burst size={24} ink="#fff" width={9} /></span><span><b>{ev.name}</b><small>Your photos are ready.</small></span><span className="now">now</span></div>
            <p className="only"><span>Plus one test, to show it works.</span></p>
          </div>
        </div>
        <p className="promise">Nothing else. No marketing.</p>
      </div>
      <div className="ob-acts">
        <button className="btn" onClick={next}>Yes, set it up</button>
        <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>
      </div>
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
      {ev.delivered ? <button className="btn ghost" onClick={onDone}>Not now</button> : <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>}
    </div>
  );

  if (step === "install") return (
    <div className="shell ob inst">
      <Steps name={ev.name} n={1} of={2} />
      <h1>First, add Lumzel to your Home Screen.</h1>
      <p>iPhone only notifies Home Screen apps. Ten seconds.</p>
      <div className="stack" style={{ gap: 16, marginTop: 6 }}>
        <div className="step"><span className="num">1</span><span>Tap <span style={{ display: "inline-flex", verticalAlign: "-5px", padding: "2px 6px", borderRadius: 2, boxShadow: "0 0 0 2px var(--you)" }}><Icon name="share" size={18} /></span> Share{p.ios && /iPad/.test(navigator.userAgent) ? " at the top" : " at the bottom"} of Safari</span></div>
        <div className="step"><span className="num">2</span><span>Scroll and tap <b className="ink" style={{ fontWeight: 500 }}>Add to Home Screen</b></span></div>
        <div className="step"><span className="num">3</span><span>Tap <b className="ink" style={{ fontWeight: 500 }}>Add</b>, then open Lumzel from your Home Screen</span></div>
      </div>
      <div className="grow" />
      <div className="row panel inst-tile" style={{ flexDirection: "row" }}>
        <span style={{ width: 52, height: 52, borderRadius: 2, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Burst size={34} ink="#F2F0EB" width={6} /></span>
        <span className="small">Opens straight into {ev.name}.</span>
      </div>
      <div className="ob-acts">
        <button className="btn" onClick={() => setStep("open")}>I've added it</button>
        {ev.delivered ? <button className="btn ghost" onClick={onDone}>Not now</button> : <button className="btn alt" onClick={() => setStep("email")}>Email me instead</button>}
      </div>
    </div>
  );

  if (step === "open") return (
    <div className="shell" style={{ background: "#2A2A28", color: "#F2F0EB", maxWidth: "none" }}>
      <div className="grow" />
      <div style={{ alignSelf: "center", width: 96, height: 96, borderRadius: 2, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #FFB000" }}><Burst size={62} ink="#F2F0EB" width={5} /></div>
      <h1 className="center" style={{ color: "#F2F0EB" }}>Now open Lumzel from your Home Screen.</h1>
      <p className="center" style={{ color: "#C9C7C2" }}>You&apos;ll land back in {ev.name}.</p>
      <div className="grow" />
      <button className="btn alt" onClick={email1}>{ev.delivered ? "It didn't work, skip this" : "It didn't work, email me instead"}</button>
    </div>
  );

  if (step === "choose") return (
    <div className="shell ob tell">{top}
      <h1>What should we tell you about?</h1>
      <div className="list">
        {!ev.delivered && <label className="li"><span>Your photos<small>{w.when.replace(/^./, (c) => c.toUpperCase())}{zone && ` ${zone}`}</small></span><input type="checkbox" className="switch" checked disabled aria-label="Photos ready, always on" /></label>}
        {ev.sharing && <>
          <label className="li"><span>You&apos;re in someone&apos;s post</span><input type="checkbox" className="switch" checked={prefs.post} onChange={(e) => setPrefs({ ...prefs, post: e.target.checked })} /></label>
          {round && <label className="li"><span>{ev.delivered ? "New posts" : "Posts from tonight"}<small>{/^One more/.test(round) ? "One more round-up" : "Once a day"}</small></span><input type="checkbox" className="switch" checked={prefs.roundup} onChange={(e) => setPrefs({ ...prefs, roundup: e.target.checked })} /></label>}
          <label className="li"><span>Likes on your post<small>Milestones only</small></span><input type="checkbox" className="switch" checked={prefs.likes} onChange={(e) => setPrefs({ ...prefs, likes: e.target.checked })} /></label>
        </>}
      </div>
      <div className="grow" />
      {err && <div className="err" role="alert">{err}</div>}
      <p className="small center">Tap Allow next. We&apos;ll send one test.</p>
      <div className="ob-acts">
        <button className="btn" onClick={turnOn} disabled={busy}>{busy ? <span className="spin" /> : "Turn on notifications"}</button>
        <button className="btn ghost" onClick={email1}>{ev.delivered ? "Not now" : "Email me instead"}</button>
      </div>
    </div>
  );

  if (step === "done") return (
    <div className="shell">
      <div className="grow" />
      <div className="moment" style={{ alignItems: "flex-start", textAlign: "left" }}>
        <Rays className="ink" style={{ width: 160, height: 160 }} />
        <h1>{ev.delivered ? "You’re set." : `You’re set. See you ${w.when}${zone && ` ${zone}`}.`}</h1>
        <p>{tested ? "We sent a test. " : ""}Change any of this in You.</p>
      </div>
      <div className="grow" />
      <button className="btn" onClick={onDone}>Back to {ev.name}</button>
    </div>
  );

  // Denied after the photos went out: there is no email to offer in its place.
  if (ev.delivered) return (
    <div className="shell">{top}
      <h1 style={{ marginTop: 16 }}>No notifications. That&apos;s fine.</h1>
      <div className="grow" />
      <div className="panel"><h3>Changed your mind?</h3><p className="small">{p.ios ? "Settings › Notifications › lumzel › Allow." : "Lock icon by the address › Notifications › Allow."}</p></div>
      <button className="btn" onClick={onDone}>Back to {ev.name}</button>
    </div>
  );

  // denied or email
  return (
    <form className="shell ob mail" onSubmit={saveEmail}>{top}
      <h1>{step === "denied" ? "No notifications. That's fine." : "We'll email you instead."}</h1>
      <p>One email, {w.when}{zone && ` ${zone}`}. Nothing else.</p>
      <label className="field">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="ob-acts">
        <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : "Email my photos"}</button>
        <button type="button" className="btn ghost" onClick={onDone}>Skip, I'll check back</button>
      </div>
      {step === "denied" ? <div className="grow" /> : <div className="fill-rays"><Rays /></div>}
      {step === "denied" && <div className="panel"><h3>Changed your mind?</h3><p className="small">{p.ios ? "Settings › Notifications › lumzel › Allow." : "Lock icon by the address › Notifications › Allow."}</p></div>}
    </form>
  );
}

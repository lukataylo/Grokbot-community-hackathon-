"use client";
import { useState } from "react";
import { api, Icon } from "../ui";

type F = {
  name: string; hostedBy: string; venue: string; date: string; start: string; end: string; deliver: string; timezone: string; expectedGuests: number;
  description: string; linkedin: string; x: string; hashtag: string; captionTemplate: string; reviewMode: "host_then_auto" | "auto"; uploads: "everyone" | "hosts"; retentionDays: number;
};
const today = () => new Date().toISOString().slice(0, 10);
const STEPS = ["Basics", "About", "Brand", "Privacy", "Delivery", "Share kit"];

export default function Setup({ hostName }: { hostName: string }) {
  const [i, setI] = useState(0);
  const [f, setF] = useState<F>({
    name: "", hostedBy: hostName, venue: "", date: today(), start: "19:00", end: "22:00", deliver: "07:30",
    timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Europe/London", expectedGuests: 100,
    description: "", linkedin: hostName, x: "", hashtag: "", captionTemplate: "", reviewMode: "host_then_auto", uploads: "everyone", retentionDays: 30,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof F>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const tag = f.hashtag ? (f.hashtag.startsWith("#") ? f.hashtag : "#" + f.hashtag.replace(/\s+/g, "")) : "";
  const handle = f.linkedin ? "@" + f.linkedin.replace(/^@/, "") : "";
  const suggested = `Great night at ${f.name || "the event"}${handle ? ` with ${handle}` : ""}. Thanks to everyone who came.${tag ? " " + tag : ""}`;

  async function create() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ id: string }>("/api/events", { method: "POST", json: { ...f, captionTemplate: f.captionTemplate || suggested } });
      location.href = `/host/e/${r.id}?created=1`;
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  const valid = [f.name.trim().length > 1 && !!f.date && !!f.start && !!f.end, true, true, true, true, true][i];
  const next = (e: React.FormEvent) => { e.preventDefault(); if (i < STEPS.length - 1) { setI(i + 1); window.scrollTo(0, 0); } else create(); };

  return (
    <form className="shell" onSubmit={next}>
      <div className="prog" aria-hidden="true">{STEPS.map((s, k) => <i key={s} className={k <= i ? "on" : ""} />)}</div>
      <div className="top">{i > 0 ? <button type="button" className="link" onClick={() => setI(i - 1)}>Back</button> : <a className="link" href="/host">Cancel</a>}<span>{i + 1} of {STEPS.length}</span></div>

      {i === 0 && <>
        <h1>What&apos;s the event?</h1>
        <label className="field">Name<input required value={f.name} onChange={set("name")} placeholder="Hack Night 03" maxLength={80} /></label>
        <label className="field">Hosted by<input value={f.hostedBy} onChange={set("hostedBy")} placeholder="Your company or community" /></label>
        <div className="two"><label className="field">Date<input type="date" required value={f.date} onChange={set("date")} /></label>
          <label className="field">Expected guests<input type="number" min={1} max={5000} value={f.expectedGuests} onChange={(e) => setF({ ...f, expectedGuests: Number(e.target.value) })} /></label></div>
        <div className="two"><label className="field">Doors<input type="time" required value={f.start} onChange={set("start")} /></label>
          <label className="field">Ends<input type="time" required value={f.end} onChange={set("end")} /></label></div>
        <label className="field">Venue<input value={f.venue} onChange={set("venue")} placeholder="Building, area" /></label>
      </>}

      {i === 1 && <>
        <h1>Tell us about it.</h1>
        <p>Guests&apos; posts are written from this, so specifics help: the theme, talks, speakers, what people will do. We never invent anything you don&apos;t write here.</p>
        <label className="field">What&apos;s happening<textarea value={f.description} onChange={set("description")} maxLength={1200} rows={7}
          placeholder={"A monthly hack night for London builders. Theme: voice agents.\nShort talk from Priya Shah on latency budgets, then four hours of building in teams, demos at 22:00."} /></label>
        <p className="hint">After the event you can add highlights too, like who won or what was demoed.</p>
      </>}

      {i === 2 && <>
        <h1>How it shows up.</h1>
        <label className="field">LinkedIn page to tag<input value={f.linkedin} onChange={set("linkedin")} placeholder="Your company page name" /></label>
        <div className="two"><label className="field">Hashtag<input value={f.hashtag} onChange={set("hashtag")} placeholder="#HackNight03" /></label>
          <label className="field">X account<input value={f.x} onChange={set("x")} placeholder="@handle" /></label></div>
        <p>Guests&apos; posts mention these, so every post points back to you.</p>
      </>}

      {i === 3 && <>
        <h1>Who&apos;s in the photos.</h1>
        <div className="list">
          <div className="li"><span>Guests choose Show me or Cover me<small>Always on, for every event</small></span><Icon name="lock" size={18} label="Fixed" /></div>
          <div className="li"><span>Anyone we can&apos;t match to a yes is tiled<small>Including people who never scan the code</small></span><Icon name="lock" size={18} label="Fixed" /></div>
        </div>
        <span className="hint">Who checks flagged photos before delivery</span>
        <div className="seg" role="group"><button type="button" aria-pressed={f.reviewMode === "host_then_auto"} onClick={() => setF({ ...f, reviewMode: "host_then_auto" })}>Me, then Lumzel</button><button type="button" aria-pressed={f.reviewMode === "auto"} onClick={() => setF({ ...f, reviewMode: "auto" })}>Lumzel only</button></div>
        <span className="hint">Who can add photos</span>
        <div className="seg" role="group"><button type="button" aria-pressed={f.uploads === "everyone"} onClick={() => setF({ ...f, uploads: "everyone" })}>Every guest</button><button type="button" aria-pressed={f.uploads === "hosts"} onClick={() => setF({ ...f, uploads: "hosts" })}>Only hosts</button></div>
        <span className="hint">Keep photos for</span>
        <div className="seg" role="group">{[7, 30, 90].map((d) => <button type="button" key={d} aria-pressed={f.retentionDays === d} onClick={() => setF({ ...f, retentionDays: d })}>{d} days</button>)}</div>
      </>}

      {i === 4 && <>
        <h1>When photos arrive.</h1>
        <span className="hint">The morning after</span>
        <div className="seg" role="group">{["07:00", "07:30", "09:00"].map((t) => <button type="button" key={t} aria-pressed={f.deliver === t} onClick={() => setF({ ...f, deliver: t })}>{t}</button>)}</div>
        <p>Overnight gives everyone time to change their mind, and gives you time to check anything flagged.</p>
        <div className="panel"><p className="small">Guests get a notification, or an email if they didn&apos;t turn notifications on. Everyone can save their photos in full quality. Faces stay tiled in every copy.</p></div>
      </>}

      {i === 5 && <>
        <h1>What guests will post.</h1>
        <label className="field">Suggested caption<textarea value={f.captionTemplate || suggested} onChange={set("captionTemplate")} rows={4} maxLength={500} /></label>
        <p className="hint">Each guest gets three versions written for them, starting from this and your description. They edit before posting.</p>
        <div className="panel">
          <h3>Free</h3><p className="small">QR code, consent and tiling, every photo pooled and delivered at {f.deliver}, downloads.</p>
          <h3 style={{ marginTop: 8 }}>£50 per event, when you want it</h3><p className="small">Social sharing: posts written for each guest, smart links that count clicks, the cheer feed, the leaderboard and your reach report. Switch it on from your event page; discount codes welcome.</p>
        </div>
      </>}

      <div className="grow" />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn" disabled={!valid || busy}>{busy ? <span className="spin" /> : i < STEPS.length - 1 ? "Next" : "Create event, free"}</button>
    </form>
  );
}

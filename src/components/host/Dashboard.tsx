"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Burst, Icon, Logo, RAYS, Rays, img, shrink, useToast } from "../ui";
import QrArt from "./QrArt";
import type { ArtState } from "@/lib/qrart";

type Stats = {
  counts: { guests: number; notify: number; photos: number; processing: number; tiled: number; delivered: number; posts: number; clicks: number; previews: number; cheers: number };
  review: Array<{ id: string; render_rev: number }>;
  recent: Array<{ id: string; render_rev: number }>;
  leaders: Array<{ name: string; clicks: number; cheers: number }>;
  event: { delivered_at: string | null; deliver_at: string; sharing_unlocked: boolean };
};
type Ev = { id: string; slug: string; name: string; startsAt: string; endsAt: string; deliverAt: string; timezone: string; description: string; highlights: string; sharing: boolean; delivered: boolean; faceStyle: "tiles" | "standins" };

export default function Dashboard({ ev, qr, art: initialArt, link, initial, notice }: { ev: Ev; qr: string; art: ArtState; link: string; initial: Stats; notice?: string }) {
  const [s, setS] = useState<Stats>(initial);
  const [art, setArt] = useState(initialArt);
  const [highlights, setHighlights] = useState(ev.highlights);
  const [description, setDescription] = useState(ev.description);
  const [faceStyle, setFaceStyle] = useState(ev.faceStyle);
  const local = (d: string, o: Intl.DateTimeFormatOptions, loc = "en-GB") => new Intl.DateTimeFormat(loc, { timeZone: ev.timezone, ...o }).format(new Date(d));
  const hm = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
  const [when, setWhen] = useState({ date: local(ev.startsAt, {}, "en-CA"), start: local(ev.startsAt, hm), end: local(ev.endsAt, hm), deliver: local(ev.deliverAt, hm) });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const { toast, node } = useToast();
  const file = useRef<HTMLInputElement>(null);
  const tz = ev.timezone;
  const t = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...o }).format(new Date(d));
  const load = useCallback(() => api<Stats>(`/api/events/${ev.id}/stats`).then(setS).catch(() => {}), [ev.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(() => document.visibilityState === "visible" && load(), 8000); return () => clearInterval(i); }, [load]);
  useEffect(() => { if (notice) toast(notice); }, [notice, toast]);

  const now = Date.now();
  const delivered = !!s.event.delivered_at;
  const status = delivered ? "Notified" : now < new Date(ev.startsAt).getTime() ? "Upcoming" : now < new Date(ev.endsAt).getTime() ? "Live" : "Waiting for " + t(s.event.deliver_at, { hour: "2-digit", minute: "2-digit" });
  const c = s.counts;

  async function act(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setErr("");
    try { await fn(); if (ok) toast(ok); await load(); } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    await act("upload", async () => {
      for (const chunk of Array.from({ length: Math.ceil(files.length / 3) }, (_, k) => Array.from(files).slice(k * 3, k * 3 + 3))) {
        const fd = new FormData(); for (const f of chunk) fd.append("photos", await shrink(f), "photo.jpg");
        await api(`/api/events/${ev.id}/photos`, { method: "POST", body: fd });
      }
    }, `${files.length} photo${files.length === 1 ? "" : "s"} added`);
  }

  const hhmm = (d: string) => t(d, { hour: "2-digit", minute: "2-digit" });
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  return (
    <main>
      {node}
      <header className="ev-hero"><div className="ev-hero-in">
      <div className="top"><Logo href="/host" /><a className="link" href="/host">All events</a></div>

      <div className="ev-head">
        <Rays spin />
        <div className="ev-title">
          <span className="ev-tag">{status === "Live" && <i />}{status}</span>
          <h1 className={ev.name.length > 22 ? "long" : undefined}>{ev.name}</h1>
          <p><span>{t(ev.startsAt, { weekday: "long", day: "numeric", month: "long" })} · <span style={{ whiteSpace: "nowrap" }}>{hhmm(ev.startsAt)}–{hhmm(ev.endsAt)}</span></span></p>
        </div>
        <section className="qr-card" aria-label="Your event code">
          <div className="qr-top">
            <div className="qr-box">{art.chosen
              ? <img className="qr" src={`/api/events/${ev.id}/qr-art/${art.chosen}?w=640`} alt="Your artistic QR code" />
              : <div className="qr" role="img" aria-label="Your event QR code" dangerouslySetInnerHTML={{ __html: qr }} />}</div>
            <div className="qr-side">
              <h2>Put this on the screen.</h2>
              <p className="small" style={{ overflowWrap: "anywhere" }}>{link.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
          <QrArt eventId={ev.id} art={art} setArt={setArt}>
            <a className="qr-act" href={`/host/e/${ev.id}/screen`} target="_blank" aria-label="Screen mode, opens in a new tab"><Icon name="screen" size={24} /><span>Screen</span><span className="nt"><Icon name="ext" size={14} width={2} /></span></a>
            <a className="qr-act" href={`/host/e/${ev.id}/poster`} target="_blank" aria-label="Poster, opens in a new tab"><Icon name="poster" size={24} /><span>Poster</span><span className="nt"><Icon name="ext" size={14} width={2} /></span></a>
            <button type="button" className="qr-act" onClick={() => { navigator.clipboard.writeText(link); toast("Link copied"); }}><Icon name="copy" size={24} /><span>Copy link</span></button>
          </QrArt>
        </section>
      </div>
      </div></header>
      <div className="shell wide dash-body" style={{ gap: 28 }}>
      {err && <div className="err" role="alert">{err}</div>}

      <section className="stats ev-stats" aria-label="Live numbers">
        <div className="stat"><span>Guests</span><strong>{c.guests}</strong></div>
        <div className="stat"><span>Photos</span><strong>{c.photos}</strong></div>
        <div className="stat"><span>Faces tiled</span><strong>{c.tiled}</strong></div>
        <div className="stat"><span>Notifications on</span><strong>{c.notify}</strong></div>
      </section>

      <div className="ev-cols">
        <div className="stack" style={{ gap: 36 }}>
          {s.review.length > 0 && <section className="sec o1" aria-label="Review">
            <div className="sec-h"><h2>{plural(s.review.length, "photo")} {delivered ? "held back. Check to publish." : `to check before ${hhmm(s.event.deliver_at)}.`}</h2></div>
            <p className="small">A face may have been missed. Publish only if everyone visible is happy to be shown.{delivered ? "" : " Unchecked photos stay hidden."}</p>
            {s.review.slice(0, 3).map((r) => (
              <div key={r.id} className="stack" style={{ gap: 10 }}>
                <img src={`/img/${r.id}?w=960&v=${r.render_rev}`} alt="Photo flagged for review" style={{ borderRadius: 2 }} />
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn sm" disabled={!!busy} onClick={() => act("r" + r.id, () => api(`/api/events/${ev.id}/review`, { method: "POST", json: { photoId: r.id, action: "approve" } }), "Published")}>Looks right</button>
                  <button className="btn alt sm" disabled={!!busy} onClick={() => act("r" + r.id, () => api(`/api/events/${ev.id}/review`, { method: "POST", json: { photoId: r.id, action: "hide" } }), "Hidden")}>Don&apos;t publish</button>
                </div>
              </div>
            ))}
          </section>}

          <section className="sec o3" aria-label="Latest photos">
            <div className="sec-h"><h2>Photos</h2>
              {c.processing > 0 && <span className="small" role="status"><span className="spin" style={{ width: 12, height: 12, verticalAlign: -1, marginRight: 6 }} />Checking {plural(c.processing, "photo")}</span>}</div>
            {s.recent.length > 0
              ? <div className="recent">{s.recent.map((p) => <div key={p.id} className="t"><img src={img(p.id, p.render_rev, 240)} alt="" loading="lazy" /></div>)}</div>
              : <div className="moment"><Rays /><h3>No photos yet.</h3><p className="small">They appear here as guests add them.</p></div>}
            <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
            <button className="btn alt" disabled={busy === "upload"} onClick={() => file.current?.click()}>{busy === "upload" ? <span className="spin" /> : <><Icon name="plus" size={18} />Add your own photos</>}</button>
          </section>
          {!delivered && <section className="sec o6" aria-label="When">
            <div className="sec-h"><h2>When</h2></div>
            <label className="field">Date<input type="date" value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} /></label>
            <div className="two"><label className="field">Doors<input type="time" value={when.start} onChange={(e) => setWhen({ ...when, start: e.target.value })} /></label>
              <label className="field">Ends<input type="time" value={when.end} onChange={(e) => setWhen({ ...when, end: e.target.value })} /></label></div>
            <label className="field">Round-up, next morning<input type="time" value={when.deliver} onChange={(e) => setWhen({ ...when, deliver: e.target.value })} /></label>
            <button className="btn alt sm" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={() => act("when", async () => { await api(`/api/events/${ev.id}`, { method: "PATCH", json: when }); location.reload(); }, "Saved")}>Save times</button>
          </section>}
          <section className="sec o7" aria-label="About the event">
            <div className="sec-h"><h2>Post brief</h2></div>
            <p className="small">Guests&apos; posts are written from this.</p>
            <label className="field">About the event<textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} /></label>
            <label className="field">Highlights<textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} maxLength={1200} placeholder="Who won, what was demoed, a line from a talk" /></label>
            <button className="btn alt sm" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={() => act("about", () => api(`/api/events/${ev.id}`, { method: "PATCH", json: { description, highlights } }), "Saved")}>Save</button>
          </section>

        </div>

        <div className="stack" style={{ gap: 36 }}>
          <section className="sec o2" aria-label="Delivery">
            {delivered ? <div className="moment" style={{ alignItems: "flex-start", textAlign: "left", paddingTop: 0 }}>
              <Rays className="ink" />
              <h2>Everyone&apos;s been notified.</h2>
              <p className="small">{plural(c.delivered, "guest")} got their photos. Late uploads still show up.</p>
            </div> : <>
              <div className="sec-h"><h2>Morning round-up</h2><span className="small">{t(s.event.deliver_at, { weekday: "long" })}</span></div>
              <div className="row between" style={{ alignItems: "flex-end" }}>
                <span className="big-time">{hhmm(s.event.deliver_at)}</span>
                <button className="btn alt sm" disabled={!!busy} onClick={() => confirm("Send every guest their round-up now?") && act("deliver", () => api(`/api/events/${ev.id}/deliver`, { method: "POST" }), "Sent")}>Send it now</button>
              </div>
              <p className="small">Each guest gets the photos they&apos;re in. Flagged photos stay hidden.</p>
            </>}
          </section>

          {!s.event.sharing_unlocked && (
            <section className="upsell o4" aria-label="Social sharing">
              <div className="row between" style={{ alignItems: "flex-start" }}><h2>Switch on social sharing</h2><Burst size={68} width={9} /></div>
              <p className="small">Guests post the night. Everyone likes each other&apos;s posts.</p>
              <div className="stack" style={{ gap: 8 }}>
                {["A post written for every guest", "Smart links that count clicks", "Guests like each other's posts", "A live leaderboard"].map((x) => <div key={x} className="step" style={{ fontSize: 15 }}><Icon name="check" size={18} width={2.2} />{x}</div>)}
              </div>
              <p className="price"><b>£50</b>per event</p>
              <button className="btn" disabled={!!busy} onClick={() => act("pay", async () => { const r = await api<{ url: string }>(`/api/events/${ev.id}/checkout`, { method: "POST" }); location.href = r.url; })}>{busy === "pay" ? <span className="spin" /> : "Unlock for £50"}</button>
              <p className="hint center">Discount code? Add it at checkout.</p>
            </section>
          )}

          {s.event.sharing_unlocked && (
            <section className="sec o4" aria-label="Reach">
              <div className="sec-h"><h2>Reach</h2><span className="live"><i />Sharing on</span></div>
              <div className="stats">
                <div className="stat"><span>Posts</span><strong>{c.posts}</strong></div>
                <div className="stat"><span>Clicks</span><strong>{c.clicks}</strong></div>
                <div className="stat"><span>Link previews</span><strong>{c.previews}</strong></div>
                <div className="stat"><span>Guest likes</span><strong>{c.cheers}</strong></div>
              </div>
              {s.leaders.length > 0
                ? <div className="leader">
                    <LeaderBurst leaders={s.leaders} />
                    <div className="list">{s.leaders.slice(0, 5).map((l, k) => <div key={l.name + k} className="li"><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span className="small" style={{ marginRight: 8 }}>{k + 1}</span>{l.name}</span><span className="small" style={{ whiteSpace: "nowrap" }}>{l.clicks} clicks · {l.cheers} likes</span></div>)}</div>
                  </div>
                : <p className="small">Posts appear here as guests share.</p>}
            </section>
          )}

          <section className="sec o5" aria-label="AI stand-ins">
            <label className="li sec-h" style={{ alignItems: "center", paddingBottom: 0 }}>
              <span><b style={{ fontWeight: 500 }}>AI stand-ins</b><small>{s.event.sharing_unlocked
                ? "Covered faces become people who don't exist. The AI only sees the tiled photo."
                : "Part of social sharing"}</small></span>
              <input type="checkbox" className="switch" aria-label="AI stand-ins" checked={s.event.sharing_unlocked && faceStyle === "standins"} disabled={!s.event.sharing_unlocked || !!busy}
                onChange={(e) => { const next = e.target.checked ? "standins" : "tiles"; act("faces", async () => { await api(`/api/events/${ev.id}`, { method: "PATCH", json: { faceStyle: next } }); setFaceStyle(next); }, next === "standins" ? "AI stand-ins on. Photos update over the next few minutes." : "Back to tiles"); }} />
            </label>
          </section>


        </div>
      </div>
      </div>
    </main>
  );
}

/** The event's burst: one ray per sharer, longer for more clicks and likes; the leader is amber. Empty slots stay as faint hairlines. */
function LeaderBurst({ leaders }: { leaders: Stats["leaders"] }) {
  const top = leaders.slice(0, 11);
  const max = Math.max(1, ...top.map((l) => l.clicks + l.cheers));
  // The brand burst's angles: the leader takes the amber "you" ray, the rest follow in order.
  const angles = [[187.8, 127.5] as [number, number], ...RAYS].map(([x, y]) => Math.atan2(y - 100, x - 100));
  const n = angles.length;
  const who = top.length === 1 ? "1 guest has shared" : `${top.length} guests have shared`;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={`${who}. ${top[0].name} leads.`}>
      {Array.from({ length: n }, (_, k) => {
        const l = top[k];
        const a = angles[k];
        const r = l ? 80 + 18 * ((l.clicks + l.cheers) / max) : 55;
        return <line key={k} x1="100" y1="100" x2={100 + Math.cos(a) * r} y2={100 + Math.sin(a) * r}
          stroke={!l ? "#D9D9D5" : k === 0 ? "#FFB000" : "#0A0A0A"} strokeWidth={!l ? 1.25 : k === 0 ? 5 : 2.5} />;
      })}
    </svg>
  );
}

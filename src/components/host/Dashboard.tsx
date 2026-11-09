"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Icon, Logo, img, shrink, useToast } from "../ui";

type Stats = {
  counts: { guests: number; notify: number; photos: number; processing: number; tiled: number; delivered: number; posts: number; clicks: number; previews: number; cheers: number };
  review: Array<{ id: string; render_rev: number }>;
  recent: Array<{ id: string; render_rev: number }>;
  leaders: Array<{ name: string; clicks: number; cheers: number }>;
  event: { delivered_at: string | null; deliver_at: string; sharing_unlocked: boolean };
};
type Ev = { id: string; slug: string; name: string; startsAt: string; endsAt: string; deliverAt: string; timezone: string; description: string; highlights: string; sharing: boolean; delivered: boolean };

export default function Dashboard({ ev, qr, link, initial, notice }: { ev: Ev; qr: string; link: string; initial: Stats; notice?: string }) {
  const [s, setS] = useState<Stats>(initial);
  const [highlights, setHighlights] = useState(ev.highlights);
  const [description, setDescription] = useState(ev.description);
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
  const status = delivered ? "Delivered" : now < new Date(ev.startsAt).getTime() ? "Upcoming" : now < new Date(ev.endsAt).getTime() ? "Live" : "Waiting for " + t(s.event.deliver_at, { hour: "2-digit", minute: "2-digit" });
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

  return (
    <main className="shell wide">
      {node}
      <div className="top"><Logo href="/host" /><a className="link" href="/host">All events</a></div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="live">{status === "Live" && <i />}{status}</span>
        <h1>{ev.name}</h1>
        <p>{t(ev.startsAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      {err && <div className="err" role="alert">{err}</div>}

      <div className="host-grid">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card" aria-label="Your event code">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ width: 132, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <h3>Put this on the screen.</h3>
                <p className="small" style={{ wordBreak: "break-all" }}>{link.replace(/^https?:\/\//, "")}</p>
                <div className="row wrap" style={{ gap: 8 }}>
                  <a className="btn sm" href={`/host/e/${ev.id}/screen`} target="_blank">Screen mode</a>
                  <a className="btn alt sm" href={`/host/e/${ev.id}/poster`} target="_blank">Poster</a>
                  <button className="btn alt sm" onClick={() => { navigator.clipboard.writeText(link); toast("Link copied"); }}>Copy link</button>
                </div>
              </div>
            </div>
          </section>

          <section className="stats" aria-label="Live numbers">
            <div className="stat"><span>Guests</span><strong>{c.guests}</strong></div>
            <div className="stat"><span>Photos</span><strong>{c.photos}</strong></div>
            <div className="stat"><span>Faces tiled</span><strong>{c.tiled}</strong></div>
            <div className="stat"><span>Notifications on</span><strong>{c.notify}</strong></div>
          </section>
          {c.processing > 0 && <p className="small"><span className="spin" style={{ width: 12, height: 12, verticalAlign: -1 }} /> Checking faces on {c.processing} photo{c.processing === 1 ? "" : "s"}</p>}

          {s.review.length > 0 && <section className="stack" aria-label="Review">
            <h2>{s.review.length} photo{s.review.length === 1 ? "" : "s"} {delivered ? "held back at delivery. Check them to publish." : `to check before ${t(s.event.deliver_at, { hour: "2-digit", minute: "2-digit" })}.`}</h2>
            <p className="small">Our second check thinks a face might have been missed. Publish only if every face you can see is someone happy to be shown.{delivered ? "" : " Anything not checked by delivery stays unpublished until you check it."}</p>
            {s.review.slice(0, 3).map((r) => (
              <div key={r.id} className="card">
                <img src={`/img/${r.id}?w=960&v=${r.render_rev}`} alt="Photo flagged for review" style={{ borderRadius: 12 }} />
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn sm" disabled={!!busy} onClick={() => act("r" + r.id, () => api(`/api/events/${ev.id}/review`, { method: "POST", json: { photoId: r.id, action: "approve" } }), "Published")}>Looks right</button>
                  <button className="btn alt sm" disabled={!!busy} onClick={() => act("r" + r.id, () => api(`/api/events/${ev.id}/review`, { method: "POST", json: { photoId: r.id, action: "hide" } }), "Hidden")}>Don&apos;t publish</button>
                </div>
              </div>
            ))}
          </section>}

          {s.recent.length > 0 && <section className="stack" aria-label="Latest photos"><h3>Latest</h3>
            <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", margin: 0 }}>{s.recent.map((p) => <div key={p.id} className="t" style={{ borderRadius: 4 }}><img src={img(p.id, p.render_rev, 240)} alt="" loading="lazy" /></div>)}</div>
          </section>}
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          {!delivered && <button className="btn alt" disabled={busy === "upload"} onClick={() => file.current?.click()}>{busy === "upload" ? <span className="spin" /> : <><Icon name="plus" size={18} />Add your own photos</>}</button>}
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <section className="card" aria-label="Delivery">
            {delivered ? <>
              <div className="row"><span style={{ width: 40, height: 40, borderRadius: 999, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={20} color="#fff" width={2.4} /></span><h2>Every guest has their photos.</h2></div>
              <p className="small">Delivered to {c.delivered} guests. You didn&apos;t send a single one.</p>
            </> : <>
              <h3>Photos go out {t(s.event.deliver_at, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</h3>
              <p className="small">By notification, or email for guests without notifications. Photos still flagged for review stay unpublished.</p>
              <button className="btn alt sm" disabled={!!busy} onClick={() => confirm("Send everyone their photos now? Guests can't add more after this.") && act("deliver", () => api(`/api/events/${ev.id}/deliver`, { method: "POST" }), "Delivered")}>Send now instead</button>
            </>}
          </section>

          {!s.event.sharing_unlocked ? (
            <section className="card" aria-label="Social sharing" style={{ borderColor: "var(--ink)" }}>
              <h2>Switch on social sharing</h2>
              <p className="small">Turn your guests into your marketing. For this event:</p>
              <div className="stack" style={{ gap: 8 }}>
                {["A post written for each guest, from your description, in their voice", "Smart links that show the photo and count every click", "Guests cheer each other's posts, so they travel further", "A live leaderboard of who shared and who clicked"].map((x) => <div key={x} className="step" style={{ fontSize: 15 }}><Icon name="check" size={18} width={2.2} />{x}</div>)}
              </div>
              <button className="btn" disabled={!!busy} onClick={() => act("pay", async () => { const r = await api<{ url: string }>(`/api/events/${ev.id}/checkout`, { method: "POST" }); location.href = r.url; })}>{busy === "pay" ? <span className="spin" /> : "Unlock for £50"}</button>
              <p className="hint center">One payment for this event. Have a discount code? Add it at checkout.</p>
            </section>
          ) : (
            <section className="card" aria-label="Reach">
              <div className="row between"><h3>Reach</h3><span className="live"><i />Sharing on</span></div>
              <div className="stats">
                <div className="stat"><span>Posts</span><strong>{c.posts}</strong></div>
                <div className="stat"><span>Clicks</span><strong>{c.clicks}</strong></div>
                <div className="stat"><span>Link previews</span><strong>{c.previews}</strong></div>
                <div className="stat"><span>Guest likes</span><strong>{c.cheers}</strong></div>
              </div>
              {s.leaders.length > 0 && <>
                <LeaderBurst leaders={s.leaders} />
                <div className="list">{s.leaders.slice(0, 5).map((l, k) => <div key={l.name + k} className="li"><span><span className="small" style={{ marginRight: 10 }}>{k + 1}</span>{l.name}</span><span className="small">{l.clicks} clicks · {l.cheers} likes</span></div>)}</div>
              </>}
              {!s.leaders.length && <p className="small">{delivered ? "Posts appear here as guests share." : "Guests can post once photos are delivered."}</p>}
            </section>
          )}

          {!delivered && <section className="card" aria-label="When">
            <h3>When</h3>
            <label className="field">Date<input type="date" value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} /></label>
            <div className="two"><label className="field">Doors<input type="time" value={when.start} onChange={(e) => setWhen({ ...when, start: e.target.value })} /></label>
              <label className="field">Ends<input type="time" value={when.end} onChange={(e) => setWhen({ ...when, end: e.target.value })} /></label></div>
            <label className="field">Photos go out the next morning at<input type="time" value={when.deliver} onChange={(e) => setWhen({ ...when, deliver: e.target.value })} /></label>
            <button className="btn alt sm" disabled={!!busy} onClick={() => act("when", async () => { await api(`/api/events/${ev.id}`, { method: "PATCH", json: when }); location.reload(); }, "Saved")}>Save times</button>
          </section>}

          <section className="card" aria-label="About the event">
            <h3>What guests&apos; posts are written from</h3>
            <label className="field">About the event<textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} /></label>
            <label className="field">Highlights, after the event<textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} maxLength={1200} placeholder="Who won, what was demoed, a line from a talk" /></label>
            <button className="btn alt sm" disabled={!!busy} onClick={() => act("about", () => api(`/api/events/${ev.id}`, { method: "PATCH", json: { description, highlights } }), "Saved")}>Save</button>
          </section>
        </div>
      </div>
    </main>
  );
}

/** The event's burst: one ray per sharer, length by clicks. */
function LeaderBurst({ leaders }: { leaders: Stats["leaders"] }) {
  const max = Math.max(1, ...leaders.map((l) => l.clicks + l.cheers));
  const n = Math.max(leaders.length, 3);
  return (
    <svg viewBox="0 0 200 200" width="100%" style={{ maxHeight: 220 }} role="img" aria-label="Burst: one ray per guest who shared, longer for more clicks">
      {leaders.map((l, k) => {
        const a = (k / n) * Math.PI * 2 - Math.PI / 2, r = 24 + 70 * ((l.clicks + l.cheers) / max);
        return <line key={k} x1="100" y1="100" x2={100 + Math.cos(a) * r} y2={100 + Math.sin(a) * r} stroke={k === 0 ? "#FFB000" : "#0A0A0A"} strokeWidth={k === 0 ? 3 : 1.6} strokeLinecap="round" />;
      })}
    </svg>
  );
}

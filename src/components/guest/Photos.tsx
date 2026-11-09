"use client";
import { useRef, useState } from "react";
import { api, Icon, Rays, img, shrink } from "../ui";
import { fmtTime, type Feed, type Photo } from "./types";

export function Photos({ slug, feed, reload, open, toast }: { slug: string; feed: Feed; reload: () => void; open: (p: Photo) => void; toast: (m: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState("");
  const ev = feed.event;
  const mine = feed.photos.filter((p) => p.with_me);
  const at = fmtTime(ev.deliverAt, ev.timezone);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setErr(""); const list = Array.from(files).slice(0, 30);
    setUp({ done: 0, total: list.length });
    let ok = 0;
    // Three at a time: quick on venue Wi-Fi without starving the connection.
    for (let i = 0; i < list.length; i += 3) {
      const fd = new FormData();
      for (const f of list.slice(i, i + 3)) fd.append("photos", await shrink(f), "photo.jpg");
      try { const r = await api<{ ids: string[] }>(`/api/g/${slug}/photos`, { method: "POST", body: fd }); ok += r.ids.length; }
      catch (x) { setErr((x as Error).message); }
      setUp({ done: Math.min(i + 3, list.length), total: list.length });
    }
    setUp(null); if (ok) toast(`${ok} photo${ok === 1 ? "" : "s"} added`); reload();
    if (input.current) input.current.value = "";
  }

  const canUpload = ev.uploads !== "hosts";
  return (
    <>
      <div className="top"><h3 style={{ color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.name}</h3>{ev.delivered ? <span>{feed.total} photo{feed.total === 1 ? "" : "s"}</span> : <span className="live"><i />Live</span>}</div>
      {!feed.total ? <div className="moment" style={{ paddingTop: 40 }}>
        <Rays spin style={{ width: 200, height: 200 }} />
        <h1>No photos yet.</h1>
        <p>Add yours. Anyone who hasn&apos;t said yes is tiled.</p>
      </div> : <div className="stack" style={{ gap: 8 }}>
        <h1>{mine.length ? `You're in ${mine.length} photo${mine.length === 1 ? "" : "s"}.` : "The night so far."}</h1>
        <p>{mine.length ? `Plus ${feed.total - mine.length} more from the room.` : feed.me?.hasFace ? "We haven't found you in any yet." : "Add a selfie in You to find yours."}</p>
      </div>}
      {mine.length > 0 && <Grid photos={mine} open={open} you />}
      {mine.length > 0 && feed.photos.length > mine.length && <div className="sec-h" style={{ marginTop: 8 }}><h3>The whole night</h3></div>}
      <Grid photos={feed.photos.filter((p) => !p.with_me)} open={open} />
      {feed.pending > 0 && <p className="small center" role="status"><span className="spin" style={{ width: 12, height: 12, verticalAlign: -1 }} /> Checking faces on {feed.pending} photo{feed.pending === 1 ? "" : "s"}…</p>}
      {err && <div className="err" role="alert">{err}</div>}
      <div className="grow" />
      {canUpload && (
        <div style={{ position: "sticky", bottom: 84, zIndex: 4 }}>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          <button className="btn" style={{ boxShadow: "6px 6px 0 var(--you)" }} onClick={() => input.current?.click()} disabled={!!up}>
            {up ? <><span className="spin" />Adding {up.done} of {up.total}</> : <><Icon name="plus" size={20} color="#fff" />Add photos</>}
          </button>
        </div>
      )}
    </>
  );
}

function Grid({ photos, open, you }: { photos: Photo[]; open: (p: Photo) => void; you?: boolean }) {
  if (!photos.length) return null;
  return (
    <div className="grid">
      {photos.map((p) => (
        <button key={p.id} className={`t${you ? " you" : ""}`} onClick={() => open(p)} aria-label={p.with_me ? "Photo you're in" : "Photo"}>
          <img src={img(p.id, p.v, 480)} alt="" loading="lazy" decoding="async" />
          {p.mine && !you && <span className="badge">Yours</span>}
        </button>
      ))}
    </div>
  );
}

async function fileFor(p: Photo, name: string) {
  const b = await (await fetch(img(p.id, p.v, 1600))).blob();
  return new File([b], `${name}-${p.id.slice(0, 6)}.jpg`, { type: "image/jpeg" });
}

/** Save to Photos via the share sheet on phones; a plain download elsewhere. */
export async function savePhotos(list: Photo[], name: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const files = await Promise.all(list.slice(0, 20).map((p) => fileFor(p, name)));
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files }) && /iPhone|iPad|Android/.test(navigator.userAgent)) {
    try { await navigator.share({ files }); return "shared"; } catch { return "cancelled"; }
  }
  for (const p of list) { const a = document.createElement("a"); a.href = `/img/${p.id}?dl=1&v=${p.v}`; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); await new Promise((r) => setTimeout(r, 250)); }
  return "downloaded";
}

export function Viewer({ p, feed, onClose, onShare, toast }: { p: Photo; feed: Feed; onClose: () => void; onShare: () => void; toast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="head">
        <button className="btn ghost sm" style={{ color: "#F2F0EB" }} onClick={onClose} aria-label="Close"><Icon name="close" size={22} /></button>
        <span className="small" style={{ color: "#A8A6A1" }}>{p.with_me ? "You're in this" : p.mine ? "You took this" : feed.event.name}</span>
        <span style={{ width: 44 }} />
      </div>
      <img src={img(p.id, p.v, 1600)} alt={p.ai ? "Photo from the event. Faces of anyone who didn't say yes are replaced by AI stand-ins." : "Photo from the event. Faces of anyone who didn't say yes are tiled."} />
      {p.ai && <p className="small center" style={{ color: "#A8A6A1", margin: "6px 0 0" }}>Covered faces are AI stand-ins</p>}
      <div className="bar">
        <button className="btn alt" disabled={busy} onClick={async () => { setBusy(true); const r = await savePhotos([p], "lumzel"); setBusy(false); if (r !== "cancelled") toast(r === "shared" ? "Saved" : "Downloaded"); }}><Icon name="down" size={20} />Save</button>
        {feed.event.sharing && <button className="btn amber" onClick={onShare}><Icon name="share" size={20} />Post</button>}
      </div>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Icon, img } from "../ui";
import type { Feed } from "./types";

type Post = { id: string; url: string; platform: "linkedin" | "x"; author: string; mine: boolean; with_me: boolean; cheered: boolean; cheers: number; clicks: number; photo_id: string | null; v: number | null };

export function Posts({ slug, feed, focus }: { slug: string; feed: Feed; focus?: string | null }) {
  const [filter, setFilter] = useState<"mine" | "all">("mine");
  const [rows, setRows] = useState<Post[] | null>(null);
  const [ask, setAsk] = useState<Post | null>(null);
  const opened = useRef<Post | null>(null);
  const load = useCallback(() => api<Post[]>(`/api/g/${slug}/posts`).then(setRows).catch(() => setRows([])), [slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const on = () => { if (document.visibilityState === "visible" && opened.current) { setAsk(opened.current); opened.current = null; } };
    document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on);
  }, []);
  useEffect(() => { if (rows && focus && !rows.find((r) => r.id === focus)?.with_me) setFilter("all"); }, [rows, focus]);

  function openPost(p: Post) { opened.current = p; window.open(p.url, "_blank", "noopener"); }
  async function cheer(p: Post, liked: boolean) {
    setAsk(null);
    await api(`/api/g/${slug}/posts/${p.id}/cheer`, { method: "POST", json: { liked } }).catch(() => {});
    load();
  }
  const list = (rows ?? []).filter((r) => filter === "all" || r.with_me || r.mine);
  const mine = (rows ?? []).filter((r) => r.mine);
  const cheered = (rows ?? []).filter((r) => r.cheered).length;

  return (
    <>
      <div className="top"><h2 style={{ color: "var(--ink)" }}>Cheer them on</h2><span>{rows?.length ?? 0} posts</span></div>
      {mine.length > 0 && <div className="panel"><div className="row between"><span className="ink">Your post{mine.length > 1 ? "s" : ""}</span><span className="small">{mine.reduce((a, p) => a + p.cheers, 0)} likes from guests · {mine.reduce((a, p) => a + p.clicks, 0)} clicks</span></div></div>}
      <div className="seg" role="group" aria-label="Filter posts">
        <button aria-pressed={filter === "mine"} onClick={() => setFilter("mine")}>You're in</button>
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Everyone</button>
      </div>
      {rows === null && <div className="skeleton" style={{ height: 180, borderRadius: 18 }} />}
      {rows && !list.length && <p className="small center" style={{ padding: "32px 0" }}>{filter === "mine" ? "No posts with you in them yet." : "Nobody has posted yet. Be the first: open a photo and tap Post."}</p>}
      <div className="list">
        {list.map((p) => (
          <div key={p.id} className="li" style={focus === p.id ? { background: "var(--panel)", margin: "0 -8px", padding: "14px 8px", borderRadius: 14 } : undefined}>
            <span className="row" style={{ minWidth: 0 }}>
              <span style={{ width: 60, height: 60, borderRadius: 10, overflow: "hidden", background: "var(--tile)", flexShrink: 0 }}>{p.photo_id && <img src={img(p.photo_id, p.v ?? 0, 240)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</span>
              <span style={{ minWidth: 0 }}><b style={{ fontWeight: 500 }}>{p.mine ? "You" : p.author}</b><small>{p.platform === "x" ? "X" : "LinkedIn"} · {p.cheers} {p.cheers === 1 ? "like" : "likes"} from guests</small>
                {p.with_me && <small style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ink)" }}><i style={{ width: 7, height: 7, borderRadius: 9, background: "var(--you)" }} />You&apos;re in this</small>}</span>
            </span>
            {p.mine ? <a className="btn alt sm" href={p.url} target="_blank" rel="noopener">View</a>
              : p.cheered ? <span className="small row" style={{ gap: 6 }}><Icon name="check" size={16} width={2.4} />Liked</span>
              : <button className="btn sm" onClick={() => openPost(p)}>Like<Icon name="ext" size={14} color="#fff" /></button>}
          </div>
        ))}
      </div>
      {rows && rows.length > 0 && <p className="small center">You cheered {cheered} of {rows.filter((r) => !r.mine).length}. Likes happen on {list[0]?.platform === "x" ? "X" : "LinkedIn"}; we just ask.</p>}
      {ask && (
        <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && setAsk(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Did you like it?">
            <span className="grab" />
            <h2>Did you like {ask.author.split(" ")[0]}&apos;s post?</h2>
            <p>{ask.platform === "x" ? "X" : "LinkedIn"} doesn&apos;t tell us, so we ask. It adds to their ray in the burst.</p>
            <div className="two"><button className="btn alt" onClick={() => setAsk(null)}>Not yet</button><button className="btn" onClick={() => cheer(ask, true)}>Yes, liked</button></div>
          </div>
        </div>
      )}
    </>
  );
}

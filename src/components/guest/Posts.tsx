"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, Burst, Icon, Rays, img } from "../ui";
import type { Feed } from "./types";

type Post = { id: string; url: string; platform: "linkedin" | "x"; author: string; mine: boolean; with_me: boolean; cheered: boolean; cheers: number; clicks: number; photo_id: string | null; v: number | null; caption: string | null; age: number; born: number };
type Ideas = { options: string[]; ai: boolean } | "loading" | "failed";
// A button that has only just appeared under a finger is not pressed on purpose: "Yes, liked" lands where "Open and like" was.
const SETTLE_MS = 700;

// A post gets most of its reach from the likes and comments of its first hour, so those go first.
const FIRST_HOUR = 3600;
const on = (p: Post) => (p.platform === "x" ? "X" : "LinkedIn");
const first = (p: Post) => p.author.trim().split(/\s+/)[0];
const initials = (p: Post) => p.author.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
function ago(s: number, short = false) {
  if (s < 60) return short ? "now" : "just now";
  if (s < 3600) return `${Math.floor(s / 60)}${short ? "m" : " min ago"}`;
  if (s < 86400) return `${Math.floor(s / 3600)}${short ? "h" : " hr ago"}`;
  const d = Math.floor(s / 86400);
  return short ? `${d}d` : `${d} day${d === 1 ? "" : "s"} ago`;
}

export function Posts({ slug, feed, focus }: { slug: string; feed: Feed; focus?: string | null; toast?: (m: string) => void }) {
  const [filter, setFilter] = useState<"mine" | "all">("mine");
  const [rows, setRows] = useState<Post[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [adding, setAdding] = useState(false);
  const [panel, setPanel] = useState<{ post: Post; queue: boolean } | null>(null); // queue: walking through every post you haven't liked yet
  const [ask, setAsk] = useState(false);       // back from LinkedIn or X: did you like it?
  const [ideas, setIdeas] = useState<Record<string, Ideas>>({});
  const [chosen, setChosen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [copyFail, setCopyFail] = useState(false);
  const skipped = useRef(new Set<string>());   // passed on during this run of the queue
  const wanted = useRef(new Set<string>());    // posts whose comment ideas were asked for
  const away = useRef(false);
  const opened = useRef(false);
  const run = useRef(0);                       // changes whenever the panel shows a post or closes: a slow save can tell it was overtaken
  const settle = useRef(0);
  const returnTo = useRef<HTMLElement | null>(null);
  const top = useRef<HTMLHeadingElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const askH = useRef<HTMLHeadingElement>(null);
  const busy = useRef(false); busy.current = !!panel;

  const fetchRows = useCallback(async () => {
    const r = await api<Array<Omit<Post, "born">>>(`/api/g/${slug}/posts`);
    const t = Date.now();
    return r.map((p) => ({ ...p, born: t - p.age * 1000 }));
  }, [slug]);
  const load = useCallback(() => fetchRows().then((r) => { setRows(r); setNow(Date.now()); }).catch(() => setRows((r) => r ?? [])), [fetchRows]);
  useEffect(() => { load(); }, [load]);
  // Ages tick over, and new posts turn up while their first hour is still running.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const poll = setInterval(() => { if (document.visibilityState === "visible" && !busy.current) load(); }, 60_000);
    const back = () => { if (document.visibilityState !== "visible") return; if (away.current) { away.current = false; setAsk(true); } else if (!busy.current) load(); };
    document.addEventListener("visibilitychange", back);
    return () => { clearInterval(tick); clearInterval(poll); document.removeEventListener("visibilitychange", back); };
  }, [load]);

  const age = (p: Post) => Math.max(0, Math.round((now - p.born) / 1000));
  const fresh = (p: Post) => age(p) < FIRST_HOUR;
  // What to like next: posts still in their first hour, then ones you're in, then the newest.
  const pending = (list: Post[]) => list.filter((r) => !r.mine && !r.cheered && !skipped.current.has(r.id))
    .sort((a, b) => Number(fresh(b)) - Number(fresh(a)) || Number(b.with_me) - Number(a.with_me) || b.born - a.born);

  const ideasFor = useCallback((p: Post) => {
    if (wanted.current.has(p.id)) return;
    wanted.current.add(p.id);
    setIdeas((m) => ({ ...m, [p.id]: "loading" }));
    api<{ options: string[]; ai: boolean }>(`/api/g/${slug}/posts/${p.id}/comments`, { method: "POST" })
      .then((r) => setIdeas((m) => ({ ...m, [p.id]: { options: r.options, ai: !!r.ai } })))
      .catch(() => { wanted.current.delete(p.id); setIdeas((m) => ({ ...m, [p.id]: "failed" })); });
  }, [slug]);

  function show(p: Post, queue: boolean, after?: Post) {
    if (!busy.current) returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    run.current++; settle.current = Date.now();
    setChosen(null); setCopyFail(false); setMore(false); setAsk(false); setErr(""); setSaving(false); away.current = false;
    setPanel({ post: p, queue });
    ideasFor(p);
    if (after) ideasFor(after); // have the next one's ideas ready
  }
  function close() {
    run.current++;
    setPanel(null); setAsk(false); setErr(""); setSaving(false); away.current = false;
    // Back to where they were: the button that opened it, or the top of the list if that button has gone ("All liked").
    requestAnimationFrame(() => { const el = returnTo.current; if (el?.isConnected && !(el as HTMLButtonElement).disabled) el.focus(); else top.current?.focus(); });
  }
  const settled = () => Date.now() - settle.current > SETTLE_MS;
  function start() { skipped.current = new Set(); const q = pending(rows ?? []); if (q[0]) show(q[0], true, q[1]); }
  function advance(list: Post[], done: Post, queue: boolean) {
    const q = pending(list).filter((r) => r.id !== done.id);
    if (queue && q[0]) show(q[0], true, q[1]); else close();
  }
  function skip() { if (!panel || saving || !settled()) return; skipped.current.add(panel.post.id); advance(rows ?? [], panel.post, panel.queue); }
  function openAndLike() {
    if (!panel || !settled()) return;
    away.current = true;
    window.open(panel.post.url, "_blank", "noopener");
    settle.current = Date.now();
    setAsk(true); // already waiting when they come back
  }
  async function answer(liked: boolean) {
    if (!panel || saving || !settled()) return;
    const p = panel.post, queue = panel.queue, mine = run.current;
    setErr("");
    if (!liked && !queue) { setAsk(false); settle.current = Date.now(); return; } // one post: stay on it, they may go again
    if (liked) {
      setSaving(true);
      try { await api(`/api/g/${slug}/posts/${p.id}/cheer`, { method: "POST", json: { liked } }); }
      catch {
        // Not saved, so not counted: say so and stay here, unless they have already moved on.
        if (run.current === mine) { setSaving(false); setErr("That didn't save. Check your connection and try again."); }
        return;
      }
    } else skipped.current.add(p.id);
    const list = await fetchRows().catch(() => (rows ?? []).map((r) => (liked && r.id === p.id ? { ...r, cheered: true, cheers: r.cheers + 1 } : r)));
    setRows(list); setNow(Date.now());
    if (run.current !== mine) return; // closed, or on another post, while this was saving: leave it be
    setSaving(false);
    advance(list, p, queue);
  }
  async function copy(text: string) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      // Older browsers and some in-app ones: copy from a field instead. It has to sit inside the panel, the only part that can take focus.
      const from = document.activeElement as HTMLElement | null, t = document.createElement("textarea");
      t.value = text; t.readOnly = true; t.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      (title.current?.parentElement ?? document.body).appendChild(t); t.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      t.remove(); from?.focus({ preventScroll: true });
    }
    setChosen(ok ? text : null); setCopyFail(!ok);
  }
  // The first post you'd be shown: have its ideas written before you ask.
  const head = rows ? pending(rows)[0] : undefined;
  useEffect(() => { if (head) ideasFor(head); }, [head?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Arriving from a notification about one post: open it.
  useEffect(() => {
    if (!rows || !focus || opened.current) return;
    opened.current = true;
    const p = rows.find((r) => r.id === focus);
    if (!p?.with_me) setFilter("all");
    if (p && !p.mine && !p.cheered) show(p, false);
  }, [rows, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = rows ?? [];
  const toLike = pending(all);                                   // this run of the queue: skipped ones are out
  const unliked = all.filter((r) => !r.mine && !r.cheered);      // the truth, skipped or not
  const hot = unliked.filter(fresh).length;
  const list = all.filter((r) => filter === "all" || r.with_me || r.mine);
  const mine = all.filter((r) => r.mine);
  const cheered = all.filter((r) => r.cheered).length;
  const others = all.filter((r) => !r.mine).length;
  const cur = panel?.post;
  const got = cur ? ideas[cur.id] : undefined;
  // Focus follows the panel: the post's title when one opens, the question when it's asked.
  useEffect(() => { if (cur) (ask ? askH : title).current?.focus({ preventScroll: true }); }, [cur?.id, ask]); // eslint-disable-line react-hooks/exhaustive-deps
  const long = !!cur?.caption && (cur.caption.length > 150 || cur.caption.split("\n").length > 3);

  return (
    <>
      <div className="top"><span className="ink">{feed.event.name}</span><span>{all.length} {all.length === 1 ? "post" : "posts"}</span></div>
      <h1 ref={top} tabIndex={-1}>Like early. Posts travel further.</h1>
      <button className="like-all" disabled={!unliked.length} onClick={start}>
        {unliked.length ? <>
          <span><b>Like them all</b><small>{hot ? `${hot} in ${hot === 1 ? "its" : "their"} first hour` : "A comment idea for each"}</small></span>
          <span className="n">{unliked.length}</span>
        </> : rows === null ? "Finding posts…" : others ? <><Icon name="check" size={18} width={2.4} />All liked</> : "Nothing to like yet"}
      </button>
      <button className="btn alt" style={{ minHeight: 48 }} onClick={() => setAdding(true)}><Icon name="plus" size={18} />Add yours</button>
      {mine.length > 0 && <div className="panel"><div className="row between"><span className="ink">Your post{mine.length > 1 ? "s" : ""}</span><span className="small">{mine.reduce((a, p) => a + p.cheers, 0)} likes · {mine.reduce((a, p) => a + p.clicks, 0)} clicks</span></div></div>}
      <div className="seg" role="group" aria-label="Filter posts">
        <button aria-pressed={filter === "mine"} onClick={() => setFilter("mine")}>You&apos;re in</button>
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Everyone</button>
      </div>
      {rows === null && <div className="skeleton" style={{ height: 180, borderRadius: 2 }} />}
      {rows && !list.length && <p className="small center" style={{ padding: "32px 0" }}>{filter === "mine" ? "No posts with you in them yet." : "No posts yet. Open a photo and tap Post."}</p>}
      <div className="list">
        {list.map((p) => (
          <div key={p.id} className="li" style={focus === p.id ? { background: "var(--panel)", margin: "0 -8px", padding: "14px 8px", borderRadius: 2 } : undefined}>
            <span className="row" style={{ minWidth: 0 }}>
              <span style={{ width: 60, height: 60, borderRadius: 2, overflow: "hidden", background: "var(--panel)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#B4B4B0" }}>{p.photo_id ? <img src={img(p.photo_id, p.v ?? 0, 240)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Burst size={28} width={6} you={false} />}</span>
              <span style={{ minWidth: 0 }}><b style={{ fontWeight: 500 }}>{p.mine ? "You" : p.author}</b><small>{on(p)} · {ago(age(p))} · {p.cheers} {p.cheers === 1 ? "like" : "likes"}</small>
                {p.with_me && <small style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ink)" }}><i style={{ width: 7, height: 7, background: "var(--you)" }} />You&apos;re in this</small>}</span>
            </span>
            {p.mine ? <a className="btn alt sm" href={p.url} target="_blank" rel="noopener">View</a>
              : p.cheered ? <span className="small row" style={{ gap: 6 }}><Icon name="check" size={16} width={2.4} />Liked</span>
              : <button className="btn sm" onClick={() => show(p, false)}>Like</button>}
          </div>
        ))}
      </div>
      {rows && others > 0 && <p className="small center">You liked {cheered} of {others}.</p>}
      {adding && <AddPost slug={slug} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); setFilter("all"); load(); }} />}

      {cur && (
        <Modal label={`${first(cur)}'s post on ${on(cur)}`} onClose={close}>
          <div className="lp-head">
            <button className="link" onClick={close}>Close</button>
            {panel.queue && <span className="small">{toLike.length} to go</span>}
          </div>
          <div className="lp-body" key={cur.id}>
            <h2 className="vh" ref={title} tabIndex={-1}>{first(cur)}&apos;s post on {on(cur)}</h2>
            <p className="live">{fresh(cur) && <i />}Posted {ago(age(cur))}.{fresh(cur) ? " Early likes count most." : ""}</p>
            <div className="stage lp-stage">
              <Rays draw={false} />
              <article className={`card lift pv ${cur.platform}`}>
                <div className="pv-h">
                  <span className="pv-av" aria-hidden="true">{initials(cur)}</span>
                  <span><b>{cur.author}</b><small>{feed.event.name} · {ago(age(cur), true)}</small></span>
                  <span className="pv-on">{on(cur)}</span>
                </div>
                <div className="pv-b">
                  {cur.caption
                    ? <><p className={long && !more ? "pv-t clamp" : "pv-t"}>{cur.caption}</p>{long && !more && <button className="pv-more" onClick={() => setMore(true)}>…more</button>}</>
                    : <p className="pv-t none">Open it to read what {first(cur)} wrote.</p>}
                </div>
                {cur.photo_id && <img src={img(cur.photo_id, cur.v ?? 0, 960)} alt="" />}
                <div className="pv-acts" aria-hidden="true">
                  {cur.platform === "x"
                    ? <><span><Icon name="comment" size={17} /></span><span><Icon name="repost" size={17} /></span><span><Icon name="heart" size={17} /></span><span><Icon name="bars" size={17} /></span></>
                    : <><span><Icon name="heart" size={17} />Like</span><span><Icon name="comment" size={17} />Comment</span><span><Icon name="repost" size={17} />Repost</span><span><Icon name="send" size={17} />Send</span></>}
                </div>
              </article>
            </div>
            {cur.caption && <p className="small pv-note">A preview from {first(cur)}&apos;s draft. The post itself may read differently.</p>}
            <section className="sec">
              <div className="sec-h"><h2>Say something</h2><span className="small" aria-live="polite">{copyFail ? "Couldn't copy. Type it in instead." : chosen ? "Copied. Paste it there." : got && typeof got === "object" ? "Tap one to copy" : got === "failed" ? "" : "Writing…"}</span></div>
              <div className="stack" role="group" aria-label="Comment ideas" style={{ gap: 10 }}>
                {got === "failed" ? <button className="link" onClick={() => ideasFor(cur)}>Couldn&apos;t write ideas. Try again</button>
                  : !got || got === "loading" ? [0, 1, 2].map((k) => <div key={k} className="skeleton" style={{ height: k === 2 ? 56 : 78 }} />)
                  : got.options.map((t, k) => (
                    <button key={k} type="button" className="opt idea" aria-pressed={chosen === t} onClick={() => copy(t)}>
                      <span>{t}</span>
                      <span className="radio">{chosen === t ? <Icon name="check" size={14} color="#fff" width={2.6} /> : <Icon name="copy" size={14} color="#8A8A85" />}</span>
                    </button>
                  ))}
              </div>
              <p className="hint">{got && typeof got === "object" && got.ai ? "Written by AI. Ideas, not a script: change the words so it sounds like you." : "Ideas, not a script. Change the words so it sounds like you."}</p>
            </section>
          </div>
          {ask ? (
            <div className="lp-foot ask">
              <div>
                <h3 ref={askH} tabIndex={-1}>Did you like {first(cur)}&apos;s post?</h3>
                <p className="small">{on(cur)} doesn&apos;t tell us, so we ask.</p>
                {err && <p className="err" role="alert">{err}</p>}
              </div>
              <button className="btn alt" disabled={saving} onClick={() => answer(false)}>Not yet</button>
              <button className="btn" disabled={saving} onClick={() => answer(true)}>{saving ? <span className="spin" /> : "Yes, liked"}</button>
            </div>
          ) : (
            <div className={panel.queue ? "lp-foot" : "lp-foot one"}>
              {panel.queue && <button className="btn alt" onClick={skip}>Skip</button>}
              <button className="btn" onClick={openAndLike}>Open and like<Icon name="ext" size={14} color="#fff" /></button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

/**
 * The like panel is a real modal: the page behind can't be reached by tab, tap or screen reader, Escape closes it from
 * anywhere, and the page doesn't scroll underneath. The browser's own dialog does the first two.
 */
function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!, root = document.documentElement, was = root.style.overflow;
    if (!d.open) d.showModal();
    root.style.overflow = "hidden";
    return () => { root.style.overflow = was; };
  }, []);
  return (
    <dialog ref={ref} className="lp-bg" aria-label={label} onCancel={(e) => { e.preventDefault(); onClose(); }} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lp">{children}</div>
    </dialog>
  );
}

/** A guest adds a post they already made on LinkedIn or X, so the rest of the room can like it. */
function AddPost({ slug, onClose, onAdded }: { slug: string; onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api(`/api/g/${slug}/posts`, { method: "POST", json: { url } }); onAdded(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label="Share your post" onSubmit={save}>
        <span className="grab" />
        <h2>Share your post</h2>
        <p>Paste your LinkedIn or X link. Everyone here can like it.</p>
        <label className="field">Link to your post<input type="text" inputMode="url" autoFocus required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/posts/…" /></label>
        <p className="hint">In the app: ··· on your post › Copy link.</p>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="two"><button type="button" className="btn alt" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || !url}>{busy ? <span className="spin" /> : "Share"}</button></div>
      </form>
    </div>
  );
}

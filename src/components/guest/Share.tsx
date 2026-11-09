"use client";
import { useEffect, useRef, useState } from "react";
import { api, Icon, Rays, img } from "../ui";
import type { Feed, Photo } from "./types";

type Caption = { style: "thanks" | "insight" | "short"; text: string; body: string };
type Draft = { code: string; link: string; captions: Caption[]; tags: string[]; ai: boolean };
const LABEL = { thanks: "Thank you", insight: "What stood out", short: "Short" } as const;

export function ShareFlow({ slug, p, feed, onClose, toast }: { slug: string; p: Photo; feed: Feed; onClose: () => void; toast: (m: string) => void }) {
  const [platform, setPlatform] = useState<"linkedin" | "x">("linkedin");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pick, setPick] = useState<Caption["style"]>("thanks");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState<"compose" | "post" | "link" | "done">("compose");
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const left = useRef(false);

  async function write() {
    setBusy(true); setErr("");
    try {
      const d = await api<Draft>(`/api/g/${slug}/share`, { method: "POST", json: { photoId: p.id, platform, note: note || undefined } });
      setDraft(d); setPick("thanks"); setText(d.captions[0].text); setStage("post");
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  useEffect(() => { if (draft) setText(draft.captions.find((c) => c.style === pick)!.text); }, [pick, draft]);
  // When they come back from LinkedIn or X, ask for the post link.
  useEffect(() => {
    const on = () => { if (document.visibilityState === "visible" && left.current) { left.current = false; setStage("link"); } };
    document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on);
  }, []);

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast("Caption copied"); }
    catch { setErr("Couldn't copy. Hold the text to copy it."); }
  }
  async function sharePhoto() {
    if (!copied) await copy();
    const b = await (await fetch(img(p.id, p.v, 1600))).blob();
    const file = new File([b], "photo.jpg", { type: "image/jpeg" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    left.current = true;
    if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch { left.current = false; } return; }
    // Desktop: download the photo and open LinkedIn's composer.
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = "photo.jpg"; a.click();
    window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank", "noopener");
  }
  function shareLink() {
    left.current = true;
    if (platform === "x") window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    else { if (!copied) copy(); window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(draft!.link)}`, "_blank", "noopener"); }
  }
  async function paste() {
    try { const t = await navigator.clipboard.readText(); setUrl(t); } catch { setErr("Paste it into the box instead."); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api(`/api/g/${slug}/posts`, { method: "POST", json: { url, code: draft?.code } }); setStage("done"); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Post this photo">
        <span className="grab" />
        <div className="row between"><button className="link" onClick={onClose}>Close</button><span className="small">{platform === "x" ? "Post on X" : "Post on LinkedIn"}</span><span style={{ width: 40 }} /></div>

        {stage === "compose" && <>
          <div style={{ borderRadius: 2, overflow: "hidden", aspectRatio: "3/2" }}><img src={img(p.id, p.v, 960)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
          <div className="seg" role="group" aria-label="Platform">
            <button aria-pressed={platform === "linkedin"} onClick={() => setPlatform("linkedin")}>LinkedIn</button>
            <button aria-pressed={platform === "x"} onClick={() => setPlatform("x")}>X</button>
          </div>
          <label className="field">Your highlight (optional)
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. our team demoed a voice agent" />
          </label>
          <p className="hint">We never add things you didn&apos;t say.</p>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn" onClick={write} disabled={busy}>{busy ? <><span className="spin" />Writing your post…</> : "Write my post"}</button>
        </>}

        {stage === "post" && draft && <>
          <div className="row wrap" role="group" aria-label="Caption style">
            {draft.captions.map((c) => <button key={c.style} className="chip" aria-pressed={pick === c.style} onClick={() => setPick(c.style)}>{LABEL[c.style]}</button>)}
          </div>
          <label className="field">Caption<textarea value={text} onChange={(e) => { setText(e.target.value); setCopied(false); }} rows={8} /></label>
          {draft.tags.length > 0 && platform === "linkedin" && <p className="hint">To tag {draft.tags.join(" and ")}, type @ and their name in LinkedIn.</p>}
          {platform === "linkedin" ? <>
            <div className="stack" style={{ gap: 12 }}>
              <div className="step"><span className={`num${copied ? " done" : ""}`}>{copied ? <Icon name="check" size={13} color="#fff" width={2.6} /> : 1}</span><span>Copy the caption</span></div>
              <div className="step"><span className="num">2</span><span>Share the photo to LinkedIn<small>Then paste the caption</small></span></div>
              <div className="step"><span className="num">3</span><span>Post, then come back with the link</span></div>
            </div>
            <div className="two"><button className="btn alt" onClick={copy}><Icon name="copy" size={18} />{copied ? "Copied" : "Copy"}</button><button className="btn" onClick={sharePhoto}><Icon name="share" size={18} color="#fff" />Share photo</button></div>
            <button className="link" onClick={shareLink}>On a computer? Share as a link instead</button>
          </> : <>
            <p className="hint">The link shows your photo as a card on X.</p>
            <button className="btn" onClick={shareLink}>Post on X</button>
          </>}
          <button className="link" onClick={() => setStage("link")}>Already posted? Add the link</button>
        </>}

        {stage === "link" && <form className="stack" onSubmit={submit}>
          <h2>Posted? Send us the link.</h2>
          <p>So tonight&apos;s guests can like it.</p>
          <div className="panel"><h3>{platform === "x" ? "On X, on your post" : "In LinkedIn, on your post"}</h3>
            <div className="step"><span className="num" style={{ background: "#fff" }}>1</span><span>{platform === "x" ? "Tap Share" : "Tap ··· at the top right"}</span></div>
            <div className="step"><span className="num" style={{ background: "#fff" }}>2</span><span>{platform === "x" ? "Tap Copy link" : "Tap Copy link to post"}</span></div>
          </div>
          <label className="field">Your post<input inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={platform === "x" ? "x.com/you/status/…" : "linkedin.com/posts/…"} /></label>
          {err && <div className="err" role="alert">{err}</div>}
          <div className="two"><button type="button" className="btn alt" onClick={paste}>Paste</button><button className="btn" disabled={busy || !url}>{busy ? <span className="spin" /> : "Add link"}</button></div>
          <button type="button" className="link" onClick={onClose}>Later</button>
        </form>}

        {stage === "done" && <div className="stack" style={{ alignItems: "center", textAlign: "center", padding: "12px 0" }}>
          <Rays className="ink" style={{ width: 160, height: 160, margin: "8px 0 12px" }} />
          <h2>You're in the burst.</h2>
          <p>Everyone here can now like it.</p>
          <button className="btn" onClick={onClose}>Done</button>
        </div>}
      </div>
    </div>
  );
}

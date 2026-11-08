"use client";
import { useState } from "react";
import { api } from "../ui";
import { platform, type Feed } from "./types";

export function You({ slug, feed, reload, editChoice, setupNotify, retakeSelfie, toast }: { slug: string; feed: Feed; reload: () => void; editChoice: () => void; setupNotify: () => void; retakeSelfie: () => void; toast: (m: string) => void }) {
  const me = feed.me!;
  const [email, setEmail] = useState(me.email ?? "");
  const [prefs, setPrefs] = useState(me.prefs);
  const p = platform();
  async function save(body: Record<string, unknown>, msg = "Saved") { await api(`/api/g/${slug}/me`, { method: "PATCH", json: body }); toast(msg); reload(); }
  async function forget() {
    if (!confirm("Remove you from this event? Your face data and tags are deleted and you'll be tiled in every photo.")) return;
    await api(`/api/g/${slug}/me`, { method: "DELETE" }); location.reload();
  }
  return (
    <>
      <div className="top"><h2 style={{ color: "var(--ink)" }}>{me.name}</h2><span>{feed.event.name}</span></div>
      <div className="list">
        <button className="li" style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", width: "100%", cursor: "pointer" }} onClick={editChoice}>
          <span>How you appear<small>{me.choice === "cover" ? "Cover me: your face is tiled" : `Show me${me.taggable ? ", happy to be tagged" : ", no tags"}`}</small></span><span className="small">Change</span></button>
        <button className="li" style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", width: "100%", cursor: "pointer" }} onClick={retakeSelfie}>
          <span>Face pattern<small>{me.hasFace ? "Saved. Used only to find you in tonight's photos." : "Not added. We can't find the photos you're in."}</small></span><span className="small">{me.hasFace ? "Retake" : "Add"}</span></button>
        {me.hasFace && <button className="li" style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", width: "100%", cursor: "pointer" }} onClick={async () => { await api(`/api/g/${slug}/selfie`, { method: "DELETE" }); toast("Face pattern deleted"); reload(); }}>
          <span>Delete my face pattern<small>You'll be tiled in every photo</small></span><span className="small">Delete</span></button>}
      </div>
      <h3 style={{ marginTop: 8 }}>Notifications</h3>
      <div className="list">
        <div className="li"><span>App notifications<small>{me.push ? "On for this device" : p.ios && !p.standalone ? "Needs Lumzel on your Home Screen" : "Off"}</small></span>
          {me.push ? <button className="link" onClick={async () => { await api(`/api/g/${slug}/push`, { method: "DELETE" }); reload(); }}>Turn off</button> : <button className="link" onClick={setupNotify}>Set up</button>}</div>
        {feed.event.sharing && <>
          <label className="li"><span>You're in someone's post</span><input type="checkbox" className="switch" checked={prefs.post} onChange={(e) => { const n = { ...prefs, post: e.target.checked }; setPrefs(n); save({ prefs: n }); }} /></label>
          <label className="li"><span>Daily round-up<small>Stops three days after the event</small></span><input type="checkbox" className="switch" checked={prefs.roundup} onChange={(e) => { const n = { ...prefs, roundup: e.target.checked }; setPrefs(n); save({ prefs: n }); }} /></label>
          <label className="li"><span>Likes on your post</span><input type="checkbox" className="switch" checked={prefs.likes} onChange={(e) => { const n = { ...prefs, likes: e.target.checked }; setPrefs(n); save({ prefs: n }); }} /></label>
        </>}
      </div>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save({ email }, "Email saved"); }}>
        <label className="field">Email, for your photos if notifications are off<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <button className="btn alt">Save email</button>
      </form>
      <div className="panel"><h3>On another phone or laptop?</h3><p className="small">Open lumzel.com/r/{me.resume} to see your photos there.</p></div>
      <button className="link" style={{ color: "var(--err)" }} onClick={forget}>Remove me from this event</button>
    </>
  );
}

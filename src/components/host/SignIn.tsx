"use client";
import { useState } from "react";
import { api, Logo } from "../ui";

export default function SignIn({ expired }: { expired?: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(expired ? "That link expired or was used. Send a new one." : "");
  const [dev, setDev] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api<{ link?: string }>("/api/host/login", { method: "POST", json: { email } }); setSent(true); setDev(r.link ?? null); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <form className="shell" onSubmit={go}>
      <div className="top"><Logo /></div>
      <div className="grow" />
      {sent ? <>
        <h1>Check your email.</h1>
        <p>Link sent to <b className="ink">{email}</b>. Works once, for 20 minutes.</p>
        {dev && <a className="btn alt" href={dev}>Open sign-in link (dev)</a>}
        <button type="button" className="link" onClick={() => setSent(false)}>Use a different email</button>
      </> : <>
        <h1 style={{ fontSize: "clamp(40px, 11vw, 52px)" }}>Host sign-in.</h1>
        <p>Use your beta email. New here? <a href="/#interest">Get beta access</a>.</p>
        <div className="grow" />
        <label className="field">Work email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : "Continue with email"}</button>
        <p className="small center">We&apos;ll email you a link. No password.</p>
      </>}
    </form>
  );
}

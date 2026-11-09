"use client";
import { useState } from "react";
import { api } from "../ui";
import type { ArtState } from "@/lib/qrart";

/** "Make it artistic": generate scan-tested designs, then pick one or go back to the plain QR. */
export default function QrArt({ eventId, art, setArt }: { eventId: string; art: ArtState; setArt: (a: ArtState) => void }) {
  const [busy, setBusy] = useState<"make" | "pick" | null>(null);
  const [msg, setMsg] = useState("");
  if (!art.enabled) return null;
  const src = (id: string) => `/api/events/${eventId}/qr-art/${id}?w=320`;

  async function make() {
    setBusy("make"); setMsg("");
    try {
      const r = await api<ArtState & { made: number }>(`/api/events/${eventId}/qr-art`, { method: "POST" });
      setArt(r);
      if (!r.made) setMsg("None scanned reliably. Try again.");
    } catch (x) { setMsg((x as Error).message); }
    setBusy(null);
  }
  async function pick(artId: string | null) {
    setBusy("pick"); setMsg("");
    try { await api(`/api/events/${eventId}/qr-art`, { method: "PUT", json: { artId } }); setArt({ ...art, chosen: artId }); }
    catch (x) { setMsg((x as Error).message); }
    setBusy(null);
  }

  return (
    <div className="stack" style={{ gap: 10 }} aria-label="Artistic QR">
      {art.candidates.length > 0 && <>
        <p className="hint">Pick one. Each passed a scan test.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {art.candidates.map((c) => (
            <button key={c.id} className="t" aria-pressed={art.chosen === c.id} disabled={!!busy} title={c.theme} onClick={() => pick(c.id)}
              style={{ borderRadius: 2, outline: art.chosen === c.id ? "2.5px solid var(--ink)" : "none", outlineOffset: 2 }}>
              <img src={src(c.id)} alt={`QR design: ${c.theme}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      </>}
      <div className="row wrap" style={{ gap: 8 }}>
        {art.remaining > 0 && <button className="btn alt sm" disabled={!!busy} onClick={make}>{busy === "make" ? <span className="spin" /> : art.candidates.length ? "Make more" : "Make it artistic"}</button>}
        {art.candidates.length > 0 && <button className="btn alt sm" aria-pressed={!art.chosen} disabled={!!busy || !art.chosen} onClick={() => pick(null)}>{art.chosen ? "Use plain QR" : "Using plain QR"}</button>}
      </div>
      {busy === "make" && <p className="hint" role="status">Painting and scan-testing three designs. 30 to 60 seconds.</p>}
      {msg && <p className="hint" role="alert" style={{ color: "var(--err)" }}>{msg}</p>}
      {!busy && <p className="hint">{art.remaining ? `${art.remaining} ${art.remaining === 1 ? "try" : "tries"} left` : "No tries left"}</p>}
    </div>
  );
}

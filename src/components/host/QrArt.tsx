"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { api, Burst, Icon } from "../ui";
import type { ArtState } from "@/lib/qrart";

/**
 * The action bar along the bottom of the QR card. `children` are the card's own actions; when artistic
 * QRs are on, "Artistic" joins them. The designs live in a sheet over the page, never in the card, so the
 * code and its actions stay put on the first screen whatever state the designs are in.
 */
export default function QrArt({ eventId, art, setArt, children }: { eventId: string; art: ArtState; setArt: (a: ArtState) => void; children: React.ReactNode }) {
  const [busy, setBusy] = useState<"make" | "pick" | null>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  if (!art.enabled) return <div className="qr-bar">{children}</div>;
  const src = (id: string) => `/api/events/${eventId}/qr-art/${id}?w=320`;

  async function make() {
    setBusy("make"); setMsg("");
    try {
      const r = await api<ArtState & { made: number }>(`/api/events/${eventId}/qr-art`, { method: "POST" });
      setArt(r);
      if (!r.made) setMsg(r.remaining ? "None scanned reliably. Try again." : "None scanned reliably, and that was the last try. Your plain QR works everywhere.");
    } catch (x) { setMsg((x as Error).message); }
    setBusy(null);
  }
  async function pick(artId: string | null) {
    setBusy("pick"); setMsg("");
    try { await api(`/api/events/${eventId}/qr-art`, { method: "PUT", json: { artId } }); setArt({ ...art, chosen: artId }); }
    catch (x) { setMsg((x as Error).message); }
    setBusy(null);
  }

  const more = art.candidates.length > 0;
  const tries = art.remaining ? `${art.remaining} ${art.remaining === 1 ? "try" : "tries"} left` : "No tries left";
  // The bar button only opens the sheet. A try is spent by the button inside it, which says so.
  return (<>
    <div className="qr-bar">
      {children}
      <button ref={opener} type="button" className="qr-act" disabled={!more && !art.remaining && !busy && !open} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Artistic QR, ${tries.toLowerCase()}`}>
        {busy === "make" ? <span className="spin" style={{ width: 24, height: 24 }} /> : <Burst size={32} width={10} />}
        <span>Artistic</span>
        <small>{tries}</small>
      </button>
    </div>
    {open && <Sheet label="Artistic QR" back={opener} onClose={() => setOpen(false)}>
      <div className="row between"><h2>Artistic QR</h2><button type="button" className="sheet-x" aria-label="Close" onClick={() => setOpen(false)}><Icon name="close" size={22} /></button></div>
      {more && <>
        <p className="hint">Pick one. Each passed a scan test.</p>
        <div className="qr-picks">
          {art.candidates.map((c, n) => (
            <button key={c.id} type="button" className="t" aria-pressed={art.chosen === c.id} disabled={!!busy} title={c.theme} onClick={() => pick(c.id)}>
              <img src={src(c.id)} alt={`QR design ${n + 1} of ${art.candidates.length}: ${c.theme}`} loading="lazy" />
            </button>
          ))}
        </div>
        <button type="button" className="btn alt sm" style={{ alignSelf: "flex-start" }} aria-pressed={!art.chosen} disabled={!!busy || !art.chosen} onClick={() => pick(null)}>{art.chosen ? "Use plain QR" : "Using plain QR"}</button>
      </>}
      {!more && !busy && !msg && <p className="hint">{art.remaining ? "Three painted versions of your code, each scan-tested. Making them uses one try." : "No tries left. Your plain QR works everywhere."}</p>}
      {busy === "make" && <p className="hint" role="status">Painting and scan-testing three designs. 30 to 60 seconds. Closing this won&apos;t stop it.</p>}
      {msg && <p className="hint" role="alert" style={{ color: "var(--err)" }}>{msg}</p>}
      <div className="stack" style={{ gap: 8 }}>
        {more && <button type="button" className="btn" onClick={() => setOpen(false)}>Done</button>}
        <button type="button" className={more ? "btn alt" : "btn"} disabled={!!busy || !art.remaining} onClick={make}>
          {busy === "make" ? <span className="spin" /> : more ? "Make three more" : "Make three designs"}
        </button>
        <p className="hint center">{tries}</p>
      </div>
    </Sheet>}
  </>);
}

/** A modal sheet: bottom of the screen on phones, a card in the middle on wider screens. Escape and the backdrop close it. */
function Sheet({ label, back, onClose, children }: { label: string; back: React.RefObject<HTMLElement | null>; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!, root = document.documentElement, was = root.style.overflow;
    if (!d.open) d.showModal();
    root.style.overflow = "hidden";
    // The sheet is unmounted while still open, so the browser doesn't hand focus back. Do it once it has gone.
    return () => { root.style.overflow = was; queueMicrotask(() => {
      if (d.isConnected) return;
      const b = back.current as HTMLButtonElement | null; // out of tries, the opener is disabled: fall back to the bar's first action
      (b && !b.disabled ? b : b?.parentElement?.querySelector<HTMLElement>("a, button:not(:disabled)"))?.focus({ preventScroll: true });
    }); };
  }, []);
  return (
    <dialog ref={ref} className="sheet-bg" aria-label={label} onCancel={(e) => { e.preventDefault(); onClose(); }} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">{children}</div>
    </dialog>
  );
}

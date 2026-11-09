import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/api";
import QRCode from "qrcode";
import { sql, migrate } from "@/lib/db";
import { currentHost } from "@/lib/auth";
import { env } from "@/lib/env";
import { Burst, Rays } from "@/components/ui";
import { chosenArtId } from "@/lib/qrart";

export const dynamic = "force-dynamic";
export default async function Screen({ params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const h = await currentHost(); if (!h) redirect("/host");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [ev] = await sql`select * from events where id = ${id} and host_id = ${h.id}`; if (!ev) notFound();
  const link = `${env.baseUrl}/${ev.slug}`;
  const art = await chosenArtId(ev as { id: string; slug: string; qr_art_key: string | null });
  const qr = art ? "" : await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return (
    <main style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "center", gap: "6vw", padding: "6vw", background: "#fff", position: "relative", overflow: "hidden", isolation: "isolate" }}>
      <Rays spin style={{ position: "absolute", zIndex: -1, scale: "-1 1", width: "220vw", height: "220vw", left: "75%", top: "50%", transform: "translate(-50%, -50%)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "2.4vw" }}>
        <span className="mark" style={{ fontSize: "2vw" }}><Burst size={36} you="ink" />lumzel</span>
        <h1 style={{ fontSize: "6.4vw", lineHeight: 0.95 }}>Scan for tonight&apos;s photos.</h1>
        <p style={{ fontSize: "2vw" }}>Show me or cover me. Every photo, live.</p>
        <p style={{ fontSize: "2.4vw", color: "#0A0A0A" }}>{link.replace(/^https?:\/\//, "")}</p>
      </div>
      {art
        ? <img src={`/api/events/${ev.id}/qr-art/${art}`} alt={`QR code for ${link}`} style={{ width: "100%", maxWidth: "70vh", justifySelf: "center", display: "block", aspectRatio: "1", border: "2px solid #0A0A0A", boxShadow: "1.4vh 1.4vh 0 #0A0A0A" }} />
        : <div style={{ width: "100%", maxWidth: "70vh", justifySelf: "center", background: "#fff", padding: "3vh", border: "2px solid #0A0A0A", boxShadow: "1.4vh 1.4vh 0 #0A0A0A" }} dangerouslySetInnerHTML={{ __html: qr }} />}
    </main>
  );
}

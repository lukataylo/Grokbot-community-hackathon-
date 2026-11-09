import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/api";
import QRCode from "qrcode";
import { sql, migrate } from "@/lib/db";
import { currentHost } from "@/lib/auth";
import { env } from "@/lib/env";
import { Burst } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function Screen({ params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const h = await currentHost(); if (!h) redirect("/host");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [ev] = await sql`select * from events where id = ${id} and host_id = ${h.id}`; if (!ev) notFound();
  const link = `${env.baseUrl}/${ev.slug}`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return (
    <main style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "center", gap: "6vw", padding: "6vw", background: "#fff" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2.4vw" }}>
        <span className="mark" style={{ fontSize: "2vw" }}><Burst size={36} you="ink" />lumzel</span>
        <h1 style={{ fontSize: "6.4vw", lineHeight: 0.95 }}>Scan for tonight&apos;s photos.</h1>
        <p style={{ fontSize: "2vw" }}>Choose to be shown or covered. Get every photo you&apos;re in tomorrow morning.</p>
        <p style={{ fontSize: "2.4vw", color: "#0A0A0A" }}>{link.replace(/^https?:\/\//, "")}</p>
      </div>
      <div style={{ width: "100%", maxWidth: "70vh", justifySelf: "center" }} dangerouslySetInnerHTML={{ __html: qr }} />
    </main>
  );
}

import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/api";
import QRCode from "qrcode";
import { sql, migrate } from "@/lib/db";
import { currentHost } from "@/lib/auth";
import { env } from "@/lib/env";
import { Burst } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function Poster({ params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const h = await currentHost(); if (!h) redirect("/host");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [ev] = await sql`select * from events where id = ${id} and host_id = ${h.id}`; if (!ev) notFound();
  const link = `${env.baseUrl}/${ev.slug}`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return (
    <main style={{ width: "210mm", minHeight: "297mm", margin: "0 auto", padding: "22mm", display: "flex", flexDirection: "column", gap: "10mm", background: "#fff" }}>
      <style>{`@page { size: A4; margin: 0 } @media print { .noprint { display: none } }`}</style>
      <span className="mark" style={{ fontSize: 22 }}><Burst size={26} you="ink" />lumzel</span>
      <h1 style={{ fontSize: 64, lineHeight: 0.95 }}>Scan for tonight&apos;s photos.</h1>
      <p style={{ fontSize: 22 }}>{ev.name}. Choose to be shown or covered. Your photos arrive tomorrow morning.</p>
      <div style={{ width: "120mm", alignSelf: "center", marginTop: "8mm" }} dangerouslySetInnerHTML={{ __html: qr }} />
      <p style={{ fontSize: 22, textAlign: "center", color: "#0A0A0A" }}>{link.replace(/^https?:\/\//, "")}</p>
      <button className="btn noprint" style={{ marginTop: "auto" }} id="p">Print</button>
      <script dangerouslySetInnerHTML={{ __html: "document.getElementById('p').onclick=()=>print()" }} />
    </main>
  );
}

import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/api";
import QRCode from "qrcode";
import { sql, migrate } from "@/lib/db";
import { currentHost } from "@/lib/auth";
import { env } from "@/lib/env";
import { stripe, markPaid } from "@/lib/stripe";
import Dashboard from "@/components/host/Dashboard";
import { artState, type QrEvent } from "@/lib/qrart";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; created?: string; cancelled?: string }> };
export const dynamic = "force-dynamic";

export default async function EventPage({ params, searchParams }: Props) {
  await migrate();
  const h = await currentHost();
  if (!h) redirect("/host");
  const { id } = await params;
  const q = await searchParams;
  if (!isUuid(id)) notFound();
  // Back from Checkout: confirm with Stripe directly so sharing switches on even before the webhook lands.
  if (q.paid && stripe) { try { await markPaid(await stripe.checkout.sessions.retrieve(q.paid)); } catch { /* the webhook will do it */ } }
  const [ev] = await sql`select * from events where id = ${id} and host_id = ${h.id}`;
  if (!ev) notFound();
  const link = `${env.baseUrl}/${ev.slug}`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0A0A0A", light: "#FFFFFF" } });
  const initial = { counts: { guests: 0, cover: 0, taggable: 0, notify: 0, photos: 0, processing: 0, tiled: 0, delivered: 0, posts: 0, clicks: 0, previews: 0, cheers: 0 }, review: [], recent: [], leaders: [],
    event: { delivered_at: ev.delivered_at?.toISOString() ?? null, deliver_at: ev.deliver_at.toISOString(), sharing_unlocked: ev.sharing_unlocked } };
  const notice = q.paid && ev.sharing_unlocked ? "Sharing is on for this event" : q.created ? "Event created" : q.cancelled ? "Payment cancelled" : undefined;
  const art = await artState(ev as QrEvent);
  return <Dashboard qr={qr} art={art} link={link} initial={initial} notice={notice}
    ev={{ id: ev.id, slug: ev.slug, name: ev.name, startsAt: ev.starts_at.toISOString(), endsAt: ev.ends_at.toISOString(), deliverAt: ev.deliver_at.toISOString(), timezone: ev.timezone, description: ev.description, highlights: ev.highlights, sharing: ev.sharing_unlocked, delivered: !!ev.delivered_at }} />;
}

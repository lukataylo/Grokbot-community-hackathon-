import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { sql, migrate } from "@/lib/db";
import { currentGuest } from "@/lib/auth";
import { isReserved } from "@/lib/ids";
import { env } from "@/lib/env";
import GuestApp from "@/components/guest/GuestApp";
import type { Feed } from "@/components/guest/types";
import { useStandins } from "@/lib/standins";
import { roundupsLeft } from "@/lib/notify";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (isReserved(slug) || !/^[a-z0-9]{3,20}$/.test(slug)) return null;
  await migrate();
  const [ev] = await sql`select * from events where slug = ${slug}`;
  return ev ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await load(slug);
  if (!ev) return {};
  return { title: ev.name, description: `Join ${ev.name}. Choose how you appear, and see every photo you're in.`, manifest: `/${slug}/manifest.webmanifest`, robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const ev = await load(slug);
  if (!ev) notFound();
  const g = await currentGuest(ev.id);
  const [{ guests }] = await sql`select count(*)::int as guests from guests where event_id = ${ev.id}`;
  // The client fetches photos itself; the first paint only needs the event and the guest. It must say the same things the
  // feed will: how faces are covered and which round-ups can still be sent are both read out on the consent screens.
  const initial: Feed = {
    event: { name: ev.name, hostedBy: ev.hosted_by, startsAt: ev.starts_at.toISOString(), endsAt: ev.ends_at.toISOString(), deliverAt: ev.deliver_at.toISOString(), delivered: !!ev.delivered_at, sharing: ev.sharing_unlocked, uploads: ev.uploads, timezone: ev.timezone,
      faceStyle: useStandins(ev as never) ? "standins" : "tiles", roundups: roundupsLeft(ev as unknown as Parameters<typeof roundupsLeft>[0]) },
    me: g ? { name: g.name, choice: g.choice, taggable: g.taggable, email: g.email, hasFace: !!g.embedding, push: !!g.push, prefs: g.prefs, resume: g.resume_code } : null,
    guests, pending: 0, photos: [], total: 0,
  };
  return <GuestApp slug={slug} initial={initial} vapid={env.vapidPublic} />;
}

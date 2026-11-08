import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { sql, migrate } from "@/lib/db";
import { env } from "@/lib/env";
import { Beacon } from "./beacon";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

async function load(code: string) {
  if (!/^[a-z0-9]{5,12}$/.test(code)) return null;
  await migrate();
  const [s] = await sql`select s.code, s.photo_id, p.render_rev, g.name as guest, e.name as event, e.hosted_by, e.slug, e.linkedin_handle
    from shares s join guests g on g.id = s.guest_id join events e on e.id = s.event_id join photos p on p.id = s.photo_id
    where s.code = ${code} and p.status = 'ready'`;
  return s ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load((await params).code);
  if (!s) return { title: "lumzel" };
  const title = `${s.guest} at ${s.event}`;
  const description = s.hosted_by ? `Photos from ${s.event}, hosted by ${s.hosted_by}.` : `Photos from ${s.event}.`;
  const image = { url: `${env.baseUrl}/s/${s.code}/og`, width: 1200, height: 630, alt: `A photo from ${s.event}` };
  return {
    title, description, alternates: { canonical: `${env.baseUrl}/s/${s.code}` },
    openGraph: { title, description, url: `${env.baseUrl}/s/${s.code}`, siteName: "lumzel", type: "article", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
    robots: { index: false },
  };
}

export default async function SmartLink({ params }: Props) {
  const s = await load((await params).code);
  if (!s) notFound();
  return (
    <main className="shell" style={{ maxWidth: 720 }}>
      <Beacon code={s.code} />
      <div className="top"><a className="mark" href="/">lumzel</a></div>
      <img src={`/img/${s.photo_id}?w=1600&v=${s.render_rev}`} alt={`A photo from ${s.event}`} style={{ width: "100%", borderRadius: 18 }} />
      <h1>{s.guest} was at {s.event}.</h1>
      {s.hosted_by && <p>Hosted by {s.hosted_by}. Everyone who didn&apos;t say yes to being shown is tiled.</p>}
      <div className="grow" />
      <div className="panel" style={{ gap: 12 }}>
        <h3>Running events?</h3>
        <p className="small">Lumzel collects every guest&apos;s photos with one QR code, covers anyone who says no, and has them shared by morning.</p>
        <a className="btn" href={`/?ref=${s.code}`}>Host your next event</a>
      </div>
    </main>
  );
}

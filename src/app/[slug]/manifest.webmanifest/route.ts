import { sql, migrate } from "@/lib/db";
import { currentGuest } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };
/** Per-guest manifest: the Home Screen icon opens a resume link, because iOS gives Home Screen apps their own cookies. */
export async function GET(_req: Request, { params }: Ctx) {
  await migrate();
  const { slug } = await params;
  const [ev] = await sql`select id, name from events where slug = ${slug}`;
  const g = ev ? await currentGuest(ev.id) : null;
  const body = {
    name: ev ? `lumzel · ${ev.name}` : "lumzel", short_name: "lumzel", id: `/${slug}`,
    start_url: g ? `/r/${g.resume_code}` : `/${slug}`, scope: "/", display: "standalone",
    background_color: "#FFFFFF", theme_color: "#FFFFFF",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, no-store" } });
}

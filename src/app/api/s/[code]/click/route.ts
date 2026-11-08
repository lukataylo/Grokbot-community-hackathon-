import { sql, migrate } from "@/lib/db";
import { limit, ip } from "@/lib/api";

type Ctx = { params: Promise<{ code: string }> };
/** Counted from a beacon the page fires after it loads, so preview crawlers (which don't run JS) aren't clicks. */
export async function POST(req: Request, { params }: Ctx) {
  await migrate();
  const { code } = await params;
  try { limit(`click:${code}:${ip(req)}`, 1, 30 * 60_000); } catch { return new Response(null, { status: 204 }); }
  await sql`update shares set clicks = clicks + 1 where code = ${code}`;
  return new Response(null, { status: 204 });
}

import { NextResponse } from "next/server";
import { sql, migrate } from "@/lib/db";
import { setGuestSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { limit, ip } from "@/lib/api";

type Ctx = { params: Promise<{ code: string }> };
/** Resume link: the Home Screen app, emails and other devices land here and are signed back in. */
export async function GET(req: Request, { params }: Ctx) {
  try { limit("resume:" + ip(req), 120, 60_000); } catch { return new Response("Too many tries. Wait a minute.", { status: 429 }); }
  await migrate();
  const { code } = await params;
  const [g] = await sql`select g.id, g.event_id, e.slug from guests g join events e on e.id = g.event_id where g.resume_code = ${code.toUpperCase()}`;
  if (!g) return NextResponse.redirect(`${env.baseUrl}/`);
  await setGuestSession(g.event_id, g.id);
  return NextResponse.redirect(`${env.baseUrl}/${g.slug}`);
}

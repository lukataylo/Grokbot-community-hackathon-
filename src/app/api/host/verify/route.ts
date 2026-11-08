import { NextResponse } from "next/server";
import { sql, migrate } from "@/lib/db";
import { sha256 } from "@/lib/ids";
import { setHostSession } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  await migrate();
  const t = new URL(req.url).searchParams.get("t") || "";
  const [row] = await sql`update login_tokens set used_at = now() where token_hash = ${sha256(t)} and used_at is null and expires_at > now() returning email`;
  if (!row) return NextResponse.redirect(`${env.baseUrl}/host?expired=1`);
  const [h] = await sql`insert into hosts (email) values (${row.email}) on conflict (email) do update set email = excluded.email returning id`;
  await setHostSession(h.id);
  const [ev] = await sql`select id from events where host_id = ${h.id} limit 1`;
  return NextResponse.redirect(`${env.baseUrl}${ev ? "/host" : "/host/new"}`);
}

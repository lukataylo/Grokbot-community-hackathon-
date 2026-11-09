import { NextResponse } from "next/server";
import { sql, migrate } from "@/lib/db";
import { sha256 } from "@/lib/ids";
import { setHostSession } from "@/lib/auth";
import { env } from "@/lib/env";

const esc = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "");

/**
 * Opening the emailed link only shows a button. Mail scanners (Outlook Safe Links and friends) fetch
 * links with GET, so a GET must never use up the one-time token.
 */
export async function GET(req: Request) {
  const t = esc(new URL(req.url).searchParams.get("t") || "");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in to Lumzel</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#0A0A0A;font:17px/1.4 -apple-system,Helvetica,Arial,sans-serif}
form{display:flex;flex-direction:column;gap:16px;padding:24px;max-width:360px;width:100%;text-align:center}
button{font:inherit;font-weight:600;padding:16px;border:0;border-radius:999px;background:#0A0A0A;color:#fff;cursor:pointer}</style></head>
<body><form method="post" action="/api/host/verify"><h1 style="margin:0;font-size:28px">Sign in to Lumzel</h1>
<input type="hidden" name="t" value="${t}"><button type="submit" autofocus>Continue</button></form></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "same-origin" } });
}

export async function POST(req: Request) {
  // Only our own confirm page may post here (stops another site signing someone into its account).
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(env.baseUrl).origin && origin !== new URL(req.url).origin) return new Response("forbidden", { status: 403 });
  await migrate();
  const t = String((await req.formData()).get("t") || "");
  const [row] = await sql`update login_tokens set used_at = now() where token_hash = ${sha256(t)} and used_at is null and expires_at > now() returning email`;
  if (!row) return NextResponse.redirect(`${env.baseUrl}/host?expired=1`, 303);
  const [h] = await sql`insert into hosts (email) values (${row.email}) on conflict (email) do update set email = excluded.email returning id`;
  await setHostSession(h.id);
  const [ev] = await sql`select id from events where host_id = ${h.id} limit 1`;
  return NextResponse.redirect(`${env.baseUrl}${ev ? "/host" : "/host/new"}`, 303);
}

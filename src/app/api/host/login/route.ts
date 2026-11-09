import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, limit, ip, HttpError } from "@/lib/api";
import { token, sha256 } from "@/lib/ids";
import { env, inBeta } from "@/lib/env";
import { sendEmail } from "@/lib/email";

export const POST = route(async (req: Request) => {
  limit("login:" + ip(req), 8, 60_000);
  const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(await req.json());
  if (!inBeta(email)) {
    const [has] = await sql`select 1 from hosts h join events e on e.host_id = h.id where h.email = ${email} limit 1`;
    if (!has) throw new HttpError(403, "Lumzel is in private beta. Register your interest at lumzel.com and we'll be in touch.");
  }
  const t = token();
  await sql`insert into login_tokens (token_hash, email, expires_at) values (${sha256(t)}, ${email}, now() + interval '20 minutes')`;
  const link = `${env.baseUrl}/api/host/verify?t=${t}`;
  const sent = await sendEmail(email, "Your Lumzel sign-in link", `Tap to sign in to Lumzel:\n\n${link}\n\nThe link works once, for 20 minutes. If you didn't ask for it, ignore this email.`);
  // Tests and local dev without email get the link back directly.
  const testing = env.testSecret && req.headers.get("x-e2e-secret") === env.testSecret;
  return json({ ok: true, ...(testing || (!sent && !env.isProd) ? { link } : {}) });
});

import { z } from "zod";
import { route, json, limit, ip, HttpError } from "@/lib/api";
import { env } from "@/lib/env";
import { canHost, sendSignInLink } from "@/lib/beta";

export const POST = route(async (req: Request) => {
  limit("login:" + ip(req), 8, 60_000);
  const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(await req.json());
  if (!(await canHost(email))) throw new HttpError(403, "Lumzel is in beta. Get access in a minute at lumzel.com: enter your email there and we'll send your sign-in link.");
  const { link, sent } = await sendSignInLink(email);
  // Tests and local dev without email get the link back directly.
  const testing = env.testSecret && req.headers.get("x-e2e-secret") === env.testSecret;
  return json({ ok: true, ...(testing || (!sent && !env.isProd) ? { link } : {}) });
});

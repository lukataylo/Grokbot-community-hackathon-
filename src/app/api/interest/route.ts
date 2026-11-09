import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, limit, ip } from "@/lib/api";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { sendSignInLink } from "@/lib/beta";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  name: z.string().trim().max(120).default(""),
  events: z.string().trim().max(500).default(""),
  website: z.string().max(200).optional(), // honeypot: people never see it, bots fill it
});

/**
 * Beta sign-up. Signing up is the beta invite: the email can host straight away, and gets a sign-in link now.
 * Re-registering updates the details and sends a fresh link rather than erroring.
 */
export const POST = route(async (req: Request) => {
  limit("interest:" + ip(req), 10, 60_000);
  const b = Body.parse(await req.json());
  let link: string | undefined;
  if (!b.website) {
    // xmax = 0 only for a freshly inserted row: re-registrations update quietly, new ones notify.
    const [row] = await sql`insert into interest (email, name, events) values (${b.email}, ${b.name}, ${b.events})
      on conflict (email) do update set name = coalesce(nullif(excluded.name, ''), interest.name),
        events = coalesce(nullif(excluded.events, ''), interest.events), updated_at = now()
      returning (xmax = 0) as inserted`;
    if (row?.inserted && env.notifyEmail) {
      const [{ n }] = await sql`select count(*)::int as n from interest`;
      sendEmail(env.notifyEmail, `New Lumzel interest: ${b.name || b.email}`,
        `${b.email}\n${b.name ? `Name or organisation: ${b.name}\n` : ""}${b.events ? `Hosts: ${b.events}\n` : ""}\nThat's ${n} on the list.`)
        .catch((e) => console.error("[interest] notify", e));
    }
    limit("welcome:" + b.email, 3, 60 * 60_000); // don't let anyone flood an inbox with links
    const r = await sendSignInLink(b.email, true);
    // Tests and local dev without email get the link back directly.
    const testing = env.testSecret && req.headers.get("x-e2e-secret") === env.testSecret;
    if (testing || (!r.sent && !env.isProd)) link = r.link;
  }
  return json({ ok: true, ...(link ? { link } : {}) }, 201);
});

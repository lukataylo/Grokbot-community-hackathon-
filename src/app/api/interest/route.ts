import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, limit, ip } from "@/lib/api";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  name: z.string().trim().max(120).default(""),
  events: z.string().trim().max(500).default(""),
  website: z.string().max(200).optional(), // honeypot: people never see it, bots fill it
});

/** Register your interest. Re-registering updates the details rather than erroring. */
export const POST = route(async (req: Request) => {
  limit("interest:" + ip(req), 10, 60_000);
  const b = Body.parse(await req.json());
  if (!b.website) {
    await sql`insert into interest (email, name, events) values (${b.email}, ${b.name}, ${b.events})
      on conflict (email) do update set name = coalesce(nullif(excluded.name, ''), interest.name),
        events = coalesce(nullif(excluded.events, ''), interest.events), updated_at = now()`;
  }
  return json({ ok: true }, 201);
});

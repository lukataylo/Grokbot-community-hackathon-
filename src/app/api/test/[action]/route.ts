import { sql, migrate } from "@/lib/db";
import { env } from "@/lib/env";
import { json, ip } from "@/lib/api";
import { queueDepth } from "@/lib/pipeline";

type Ctx = { params: Promise<{ action: string }> };
/** End-to-end test hooks. Disabled unless E2E_SECRET is set and sent. */
export async function POST(req: Request, { params }: Ctx) {
  if (!env.testSecret || req.headers.get("x-e2e-secret") !== env.testSecret) return new Response("not found", { status: 404 });
  await migrate();
  const { action } = await params;
  const b = await req.json().catch(() => ({}));
  if (action === "ip") return json({ ip: ip(req) }); // checks what the edge lets a client forge
  if (action === "unlock") { await sql`update events set sharing_unlocked = true where id = ${b.eventId}`; return json({ ok: true }); }
  if (action === "photos") {
    const rows = await sql`select p.id, p.status, p.tiled_count, p.model_count, p.has_standins, p.render_rev, (select outcome from standin_run sr where sr.photo_id = p.id order by sr.id desc limit 1) as standin, jsonb_array_length(p.regions) as regions,
        (select count(*)::int from photo_people pp where pp.photo_id = p.id) as people,
        (select array_agg(r->>'guestId') from jsonb_array_elements(p.regions) r where r->>'guestId' is not null) as matched
      from photos p join events e on e.id = p.event_id where e.slug = ${b.slug}`;
    return json({ rows, queue: queueDepth() });
  }
  if (action === "share") { const [s] = await sql`select code, clicks, previews from shares s join events e on e.id = s.event_id where e.slug = ${b.slug} order by s.created_at desc limit 1`; return json(s ?? null); }
  if (action === "cleanup") { await sql`delete from hosts where email like 'e2e+%@lumzel.test'`; await sql`delete from interest where email like 'e2e+%@lumzel.test'`; return json({ ok: true }); }
  if (action === "interest") { const [r] = await sql`select email, name, events from interest where email = ${b.email}`; return json(r ?? null); }
  return new Response("unknown", { status: 400 });
}

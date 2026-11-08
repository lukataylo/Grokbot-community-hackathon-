import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireGuest } from "@/lib/api";
import { rerenderEvent } from "@/lib/pipeline";

type Ctx = { params: Promise<{ slug: string }> };
const Body = z.object({
  choice: z.enum(["show", "cover"]).optional(),
  taggable: z.boolean().optional(),
  email: z.string().trim().toLowerCase().email().max(200).or(z.literal("")).optional(),
  name: z.string().trim().min(1).max(60).optional(),
  prefs: z.object({ post: z.boolean(), roundup: z.boolean(), likes: z.boolean(), host: z.boolean() }).partial().optional(),
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  const b = Body.parse(await req.json());
  if (b.choice && ev.delivered_at && b.choice === "show" && g.choice === "cover") { /* allowed: it only reveals them */ }
  await sql`update guests set
    choice = coalesce(${b.choice ?? null}, choice),
    taggable = coalesce(${b.taggable ?? null}, taggable),
    email = case when ${b.email === undefined} then email else nullif(${b.email ?? ""}, '') end,
    name = coalesce(${b.name ?? null}, name),
    prefs = prefs || ${sql.json((b.prefs ?? {}) as never)}
    where id = ${g.id}`;
  if (b.choice && b.choice !== g.choice) await rerenderEvent(ev.id);
  if (b.choice === "cover") await sql`update guests set taggable = false where id = ${g.id}`;
  return json({ ok: true });
});

/** "Forget me": removes the guest, their face data and their tags. Their face is tiled in every photo from then on. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  await sql`delete from guests where id = ${g.id}`;
  await rerenderEvent(ev.id);
  return json({ ok: true });
});

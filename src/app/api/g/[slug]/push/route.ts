import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireGuest } from "@/lib/api";
import { pushGuest } from "@/lib/push";
import { env } from "@/lib/env";

type Ctx = { params: Promise<{ slug: string }> };
const Sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  const sub = Sub.parse(await req.json());
  await sql`update guests set push = ${sql.json(sub as never)} where id = ${g.id}`;
  await pushGuest(g.id, { title: ev.name, body: "This is how your photos will arrive.", url: `${env.baseUrl}/${ev.slug}`, tag: "test" });
  return json({ ok: true });
});
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { g } = await requireGuest((await params).slug);
  await sql`update guests set push = null where id = ${g.id}`;
  return json({ ok: true });
});

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
  // Without sharing, the guest was told "one notification, nothing else" and never saw the post switches. If the
  // host unlocks sharing later, those stay off until the guest turns them on in You.
  const quiet = { post: false, roundup: false, likes: false };
  await sql`update guests set push = ${sql.json(sub as never)}, prefs = case when ${ev.sharing_unlocked} then prefs else ${sql.json(quiet as never)} end where id = ${g.id}`;
  const test = await pushGuest(g.id, { title: ev.name, body: ev.delivered_at ? "Notifications are on." : "This is how your photos will arrive.", url: `${env.baseUrl}/${ev.slug}`, tag: "test" });
  return json({ ok: true, test });
});
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { g } = await requireGuest((await params).slug);
  await sql`update guests set push = null where id = ${g.id}`;
  return json({ ok: true });
});

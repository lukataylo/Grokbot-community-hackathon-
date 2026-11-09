import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireGuest, limit } from "@/lib/api";
import { markStale, photosOf, settleGuestChange } from "@/lib/pipeline";

type Ctx = { params: Promise<{ slug: string }> };
const Body = z.object({
  choice: z.enum(["show", "cover"]).optional(),
  taggable: z.boolean().optional(),
  email: z.string().trim().toLowerCase().email().max(200).or(z.literal("")).optional(),
  name: z.string().trim().min(1).max(60).optional(),
  prefs: z.object({ post: z.boolean(), roundup: z.boolean(), likes: z.boolean() }).partial().optional(),
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { g } = await requireGuest((await params).slug);
  limit("me:" + g.id, 30, 60_000);
  const b = Body.parse(await req.json());
  const cover = b.choice === "cover";
  // The choice and the re-render mark commit together: a crash or failed request can't leave a
  // guest marked Cover with photos still showing them. Cover always re-marks, so a retry repairs too.
  let changed = false;
  const ids = await sql.begin(async (tx) => {
    // Compare with the choice as it is now, under a row lock, not as it was when this request arrived:
    // a slow request must not skip the re-render another request made necessary.
    const [cur] = await tx`select choice from guests where id = ${g.id} for update`;
    await tx`update guests set
    choice = coalesce(${b.choice ?? null}, choice),
    taggable = ${cover} = false and coalesce(${b.taggable ?? null}, taggable),
    email = case when ${b.email === undefined} then email else nullif(${b.email ?? ""}, '') end,
    name = coalesce(${b.name ?? null}, name),
    prefs = prefs || ${tx.json((b.prefs ?? {}) as never)}
    where id = ${g.id}`;
    // Only the photos they were matched in change. Going to Cover withholds them until re-tiled.
    if (!b.choice || (b.choice === cur?.choice && !cover)) return [];
    changed = true;
    const ids = await photosOf(tx, g.id, g.event_id);
    await markStale(tx, ids, cover);
    return ids;
  });
  if (changed) await settleGuestChange(g.id, g.event_id, ids, cover);
  return json({ ok: true });
});

/** "Forget me": removes the guest, their face data and their tags. Their face is tiled in every photo from then on. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { g } = await requireGuest((await params).slug);
  const ids = await sql.begin(async (tx) => {
    const ids = await photosOf(tx, g.id, g.event_id);
    await markStale(tx, ids, true); // marked before the delete takes their matches with it
    await tx`delete from guests where id = ${g.id}`;
    return ids;
  });
  await settleGuestChange(g.id, g.event_id, ids, true); // a render matching the deleted guest fails its FK and retries
  return json({ ok: true });
});

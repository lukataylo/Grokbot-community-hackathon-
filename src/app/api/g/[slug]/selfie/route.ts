import { sql } from "@/lib/db";
import { route, json, requireGuest, HttpError, limit, form } from "@/lib/api";
import { selfieEmbedding } from "@/lib/faces";
import { rerenderEvent, markStale, photosOf, settleGuestChange } from "@/lib/pipeline";

type Ctx = { params: Promise<{ slug: string }> };
/** Turns a selfie into a face embedding. The image is never written anywhere. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  limit("selfie:" + g.id, 6, 60_000);
  const f = (await form(req)).get("selfie");
  if (!f || typeof f === "string") throw new HttpError(400, "No photo received");
  const r = await selfieEmbedding(Buffer.from(await f.arrayBuffer())).catch((e) => { console.warn("[selfie]", (e as Error).message); return "unreadable" as const; });
  if (r === "unreadable") throw new HttpError(422, "We couldn't read that photo. Try taking it again.");
  if (r === "several") throw new HttpError(422, "Only you in the photo, please. We found more than one face.");
  if (!r) throw new HttpError(422, "We couldn't see a face. Try again facing the camera, in good light.");
  const emb = r;
  await sql`update guests set embedding = ${emb} where id = ${g.id}`;
  await rerenderEvent(ev.id);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { g } = await requireGuest((await params).slug);
  const ids = await sql.begin(async (tx) => {
    const ids = await photosOf(tx, g.id, g.event_id);
    await markStale(tx, ids, true);
    await tx`update guests set embedding = null where id = ${g.id}`;
    return ids;
  });
  await settleGuestChange(g.id, g.event_id, ids, true);
  return json({ ok: true });
});

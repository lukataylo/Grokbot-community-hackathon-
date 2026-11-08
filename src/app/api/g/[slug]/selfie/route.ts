import { sql } from "@/lib/db";
import { route, json, requireGuest, HttpError, limit } from "@/lib/api";
import { selfieEmbedding } from "@/lib/faces";
import { rerenderEvent } from "@/lib/pipeline";

type Ctx = { params: Promise<{ slug: string }> };
/** Turns a selfie into a face embedding. The image is never written anywhere. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  limit("selfie:" + g.id, 6, 60_000);
  const f = (await req.formData()).get("selfie");
  if (!f || typeof f === "string") throw new HttpError(400, "No photo received");
  const emb = await selfieEmbedding(Buffer.from(await f.arrayBuffer()));
  if (!emb) throw new HttpError(422, "We couldn't see a face. Try again facing the camera, in good light.");
  await sql`update guests set embedding = ${emb} where id = ${g.id}`;
  await rerenderEvent(ev.id);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  await sql`update guests set embedding = null where id = ${g.id}`;
  await rerenderEvent(ev.id);
  return json({ ok: true });
});

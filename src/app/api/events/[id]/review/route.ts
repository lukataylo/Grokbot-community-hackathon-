import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireHostEvent, HttpError } from "@/lib/api";
import { render, enqueue } from "@/lib/pipeline";
import type { Region } from "@/lib/faces";

type Ctx = { params: Promise<{ id: string }> };

/** approve: publish as is. tile_all: tile every face and head, then publish. hide: never publish. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev } = await requireHostEvent((await params).id);
  const { photoId, action } = z.object({ photoId: z.string().uuid(), action: z.enum(["approve", "tile_all", "hide"]) }).parse(await req.json());
  const [p] = await sql`select id, regions from photos where id = ${photoId} and event_id = ${ev.id}`;
  if (!p) throw new HttpError(404, "Photo not found");
  if (action === "hide") { await sql`update photos set status = 'hidden', reviewed_at = now() where id = ${photoId}`; return json({ ok: true }); }
  if (action === "tile_all") {
    const regions = (p.regions as Region[]).map((r) => ({ ...r, embedding: undefined }));
    await sql`update photos set regions = ${sql.json(regions as never)} where id = ${photoId}`;
  }
  await sql`update photos set reviewed_at = now(), needs_review = false where id = ${photoId}`;
  enqueue(() => render(photoId));
  return json({ ok: true });
});

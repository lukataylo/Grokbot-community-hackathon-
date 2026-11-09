import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, requireHostEvent, HttpError } from "@/lib/api";
import { rerender } from "@/lib/pipeline";

type Ctx = { params: Promise<{ id: string }> };

/**
 * approve: the host checked it, publish. hide: never publish.
 * Works on flagged photos, and on flagged photos delivery held back unchecked (hidden, never reviewed),
 * so an outage of the second check on the night doesn't lose the event's photos for good.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev } = await requireHostEvent((await params).id);
  const { photoId, action } = z.object({ photoId: z.string().uuid(), action: z.enum(["approve", "hide"]) }).parse(await req.json());
  const [p] = await sql`select id from photos where id = ${photoId} and event_id = ${ev.id}
    and (status = 'review' or (status = 'hidden' and reviewed_at is null))`;
  // Only photos that finished detection and were flagged: approving one mid-processing would publish it untiled.
  if (!p) throw new HttpError(404, "That photo isn't waiting for review");
  if (action === "hide") { await sql`update photos set status = 'hidden', reviewed_at = now() where id = ${photoId}`; return json({ ok: true }); }
  await sql`update photos set status = 'review', reviewed_at = now(), needs_review = false where id = ${photoId}`;
  await rerender([photoId]);
  return json({ ok: true });
});

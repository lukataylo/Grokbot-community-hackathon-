import { route, json, requireGuest, HttpError, isUuid, limit } from "@/lib/api";
import { ideas } from "@/lib/comments";

type Ctx = { params: Promise<{ slug: string; id: string }> };

/** Three comment ideas for this guest on this post. Written once per guest and post, then reused. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const { ev, g } = await requireGuest(slug);
  if (!ev.sharing_unlocked) throw new HttpError(402, "Sharing isn't switched on for this event");
  if (!isUuid(id)) throw new HttpError(404, "Post not found");
  // Past the limit a guest still gets ideas, just not model-written ones.
  let model = true;
  try { limit("comments:" + g.id, 20, 60_000); limit("comments-ev:" + ev.id, 240, 60_000); limit("comments-day:" + ev.id, 4000, 86_400_000); } catch { model = false; }
  const out = await ideas(ev, id, g, model);
  if (!out) throw new HttpError(404, "Post not found");
  return json(out);
});

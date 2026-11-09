import sharp from "sharp";
import { sql } from "@/lib/db";
import * as store from "@/lib/storage";
import { route, requireHostEvent, HttpError, isUuid } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; artId: string }> };

/** Any candidate, to its host only (for picking). ?w=320 for a light thumbnail; the originals are 1-2 MB. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id, artId } = await params;
  const { ev } = await requireHostEvent(id);
  if (!isUuid(artId)) throw new HttpError(404, "Not found");
  const [a] = await sql`select key from qr_art where id = ${artId} and event_id = ${ev.id}`;
  const buf = a && (await store.get(a.key));
  if (!buf) throw new HttpError(404, "Not found");
  const out = new URL(req.url).searchParams.get("w") ? await sharp(buf).resize({ width: 320 }).jpeg({ quality: 82 }).toBuffer() : buf;
  return new Response(new Uint8Array(out), { headers: { "Content-Type": out === buf ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=86400" } });
});

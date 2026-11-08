import { sql } from "./db";
import * as store from "./storage";
import { ingest, processPhoto } from "./pipeline";
import { HttpError } from "./api";

const MAX_FILES = 30, MAX_BYTES = 25 * 1024 * 1024;

export async function acceptPhotos(eventId: string, guestId: string | null, byHost: boolean, form: FormData) {
  const files = form.getAll("photos").filter((f): f is File => typeof f !== "string");
  if (!files.length) throw new HttpError(400, "No photos received");
  if (files.length > MAX_FILES) throw new HttpError(400, `Up to ${MAX_FILES} photos at a time`);
  const ids: string[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) continue;
    let ing;
    try { ing = await ingest(Buffer.from(await f.arrayBuffer())); } catch { continue; } // not an image we can read
    const [p] = await sql`insert into photos (event_id, guest_id, by_host, original_key, width, height)
      values (${eventId}, ${guestId}, ${byHost}, '', ${ing.width}, ${ing.height}) returning id`;
    const key = `e/${eventId}/orig/${p.id}.jpg`;
    await store.put(key, ing.buf);
    await sql`update photos set original_key = ${key} where id = ${p.id}`;
    processPhoto(p.id);
    ids.push(p.id);
  }
  if (!ids.length) throw new HttpError(400, "We couldn't read those files. Try JPEG or HEIC photos.");
  return ids;
}

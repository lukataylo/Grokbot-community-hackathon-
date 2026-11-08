import sharp from "sharp";
import { sql, migrate } from "@/lib/db";
import * as store from "@/lib/storage";
import { burstSvg } from "@/lib/brand";

type Ctx = { params: Promise<{ code: string }> };
/** 1200×630 link preview: the tiled photo, full bleed, with the mark. Crawlers fetch this, so it counts previews. */
export async function GET(_req: Request, { params }: Ctx) {
  await migrate();
  const { code } = await params;
  const [s] = await sql`update shares set previews = previews + 1 where code = ${code} returning photo_id`;
  if (!s) return new Response("not found", { status: 404 });
  const [p] = await sql`select public_key from photos where id = ${s.photo_id} and status = 'ready'`;
  const buf = p && (await store.get(p.public_key));
  if (!buf) return new Response("not found", { status: 404 });
  const mark = await sharp(Buffer.from(burstSvg(84))).png().toBuffer();
  const out = await sharp(buf).resize(1200, 630, { fit: "cover", position: "attention" })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104"><rect width="104" height="104" rx="22" fill="#0A0A0A"/></svg>`), left: 1072, top: 502 }, { input: mark, left: 1082, top: 512 }])
    .jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(out), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}

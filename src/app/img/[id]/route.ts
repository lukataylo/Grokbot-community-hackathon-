import sharp from "sharp";
import { sql, migrate } from "@/lib/db";
import * as store from "@/lib/storage";
import { currentHost } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };
const SIZES = [240, 480, 960, 1600];

/** Only ever serves the tiled public version. Ready photos by capability URL; review photos to their host only. */
export async function GET(req: Request, { params }: Ctx) {
  await migrate();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("not found", { status: 404 });
  const [p] = await sql`select p.public_key, p.status, p.render_rev, e.host_id, e.slug from photos p join events e on e.id = p.event_id where p.id = ${id}`;
  if (!p?.public_key || p.status === "hidden" || p.status === "failed" || p.status === "processing") return new Response("not found", { status: 404 });
  const isPublic = p.status === "ready";
  if (!isPublic) { const h = await currentHost(); if (h?.id !== p.host_id) return new Response("not found", { status: 404 }); }
  const u = new URL(req.url);
  const want = Number(u.searchParams.get("w")) || 0;
  const w = SIZES.find((s) => s >= want) ?? 0;
  const buf = await store.get(p.public_key);
  if (!buf) return new Response("not found", { status: 404 });
  const out = w ? await sharp(buf).resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer() : buf;
  const headers: Record<string, string> = {
    "Content-Type": "image/jpeg",
    "Cache-Control": isPublic && u.searchParams.get("v") === String(p.render_rev) ? "public, max-age=31536000, immutable" : "private, no-store",
  };
  if (u.searchParams.get("dl")) headers["Content-Disposition"] = `attachment; filename="${p.slug}-${id.slice(0, 8)}.jpg"`;
  return new Response(new Uint8Array(out), { headers });
}

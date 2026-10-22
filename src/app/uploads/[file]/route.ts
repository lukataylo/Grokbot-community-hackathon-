import fs from "node:fs";
import path from "node:path";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const full = path.join(process.cwd(), "data", "uploads", path.basename(file));
  if (!fs.existsSync(full)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(full), { headers: { "Content-Type": TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream" } });
}

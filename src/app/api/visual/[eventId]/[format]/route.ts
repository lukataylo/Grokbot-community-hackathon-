import { readDB } from "@/lib/store";
import { FORMATS, renderVisual } from "@/lib/visual";
import type { VisualFormat } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string; format: string }> }) {
  const { eventId, format } = await params;
  const kit = readDB().kits?.[eventId];
  const f = format.replace(/\.svg$/, "") as VisualFormat;
  if (!kit || !(f in FORMATS)) return new Response("Not found", { status: 404 });
  return new Response(renderVisual(kit, f), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}

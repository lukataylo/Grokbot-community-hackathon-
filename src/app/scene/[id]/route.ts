import { readDB } from "@/lib/store";
import { parseSceneUrl, renderScene } from "@/lib/scene";

export async function GET(req: Request) {
  const { id, bg, who } = parseSceneUrl(req.url);
  const db = readDB();
  const people = who.map((w) => db.attendees.find((a) => a.id === w)).filter((a) => !!a);
  return new Response(renderScene(id, bg, people), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}

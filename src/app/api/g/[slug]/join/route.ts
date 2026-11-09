import { z } from "zod";
import { sql } from "@/lib/db";
import { route, json, eventBySlug, limit, ip, HttpError } from "@/lib/api";
import { setGuestSession, currentGuest } from "@/lib/auth";
import { resumeCode } from "@/lib/ids";

type Ctx = { params: Promise<{ slug: string }> };
export const POST = route(async (req: Request, { params }: Ctx) => {
  limit("join:" + ip(req), 120, 60_000); // a whole venue can share one IP
  const ev = await eventBySlug((await params).slug);
  if (ev.delivered_at && Date.now() - new Date(ev.delivered_at).getTime() > 7 * 86400_000) throw new HttpError(410, "This event has closed");
  const existing = await currentGuest(ev.id);
  if (existing) return json({ id: existing.id });
  const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(await req.json());
  const [g] = await sql`insert into guests (event_id, name, resume_code) values (${ev.id}, ${name}, ${resumeCode()}) returning id`;
  await setGuestSession(ev.id, g.id);
  return json({ id: g.id }, 201);
});

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { sql, migrate } from "./db";
import { currentHost, currentGuest } from "./auth";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export function route<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => {
    try { await migrate(); return await fn(...a); }
    catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof ZodError) return json({ error: "Please check the form.", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
      console.error("[api]", e);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function eventBySlug(slug: string) {
  const [ev] = await sql`select * from events where slug = ${slug.toLowerCase()}`;
  if (!ev) throw new HttpError(404, "Event not found");
  return ev;
}
export async function requireGuest(slug: string) {
  const ev = await eventBySlug(slug);
  const g = await currentGuest(ev.id);
  if (!g) throw new HttpError(401, "Join the event first");
  return { ev, g };
}
export async function requireHost() {
  const h = await currentHost();
  if (!h) throw new HttpError(401, "Please sign in");
  return h;
}
export async function requireHostEvent(eventId: string) {
  const h = await requireHost();
  const [ev] = await sql`select * from events where id = ${eventId} and host_id = ${h.id}`;
  if (!ev) throw new HttpError(404, "Event not found");
  return { h, ev };
}

/** Very small fixed-window rate limiter, per key, in memory (single instance). */
const hits = new Map<string, { n: number; t: number }>();
export function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); return; }
  if (++h.n > max) throw new HttpError(429, "Too many requests. Try again in a minute.");
}
export const ip = (req: Request) => req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";
import { sql } from "./db";

const key = new TextEncoder().encode(env.sessionSecret);
const HOST = "lz_host";
const guestCookie = (eventId: string) => `lz_g_${eventId.replace(/-/g, "").slice(0, 16)}`;
const base = { httpOnly: true, sameSite: "lax" as const, secure: env.isProd, path: "/" };

export async function sign(payload: Record<string, unknown>, days: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${days}d`).sign(key);
}
export async function verify<T>(t: string | undefined): Promise<T | null> {
  if (!t) return null;
  try { return (await jwtVerify(t, key)).payload as T; } catch { return null; }
}

export async function setHostSession(hostId: string) {
  (await cookies()).set(HOST, await sign({ h: hostId }, 30), { ...base, maxAge: 30 * 86400 });
}
export async function clearHostSession() { (await cookies()).delete(HOST); }
export async function currentHost() {
  const p = await verify<{ h: string }>((await cookies()).get(HOST)?.value);
  if (!p) return null;
  const [h] = await sql`select id, email, name from hosts where id = ${p.h}`;
  return (h as { id: string; email: string; name: string | null } | undefined) ?? null;
}

export async function setGuestSession(eventId: string, guestId: string) {
  (await cookies()).set(guestCookie(eventId), await sign({ g: guestId, e: eventId }, 120), { ...base, maxAge: 120 * 86400 });
}
export async function currentGuest(eventId: string) {
  const p = await verify<{ g: string; e: string }>((await cookies()).get(guestCookie(eventId))?.value);
  if (!p || p.e !== eventId) return null;
  const [g] = await sql`select * from guests where id = ${p.g} and event_id = ${eventId}`;
  return (g as Guest | undefined) ?? null;
}

export type Guest = {
  id: string; event_id: string; name: string; email: string | null; choice: "show" | "cover" | null;
  taggable: boolean; embedding: number[] | null; resume_code: string; push: unknown; prefs: Prefs; delivered_at: Date | null;
};
export type Prefs = { post: boolean; roundup: boolean; likes: boolean; host: boolean };

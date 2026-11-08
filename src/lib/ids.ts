import { customAlphabet } from "nanoid";
import crypto from "crypto";

const lower = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 10);
export const shortCode = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 7);
export const resumeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
export const token = () => crypto.randomBytes(32).toString("base64url");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const RESERVED = new Set(["host", "api", "s", "r", "img", "e", "landing", "sw", "manifest", "icons", "pricing", "privacy", "terms", "login", "admin", "www", "app", "static", "_next"]);
export function slugFrom(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "").slice(0, 8);
  const s = (base.length >= 3 ? base : "event") + lower().slice(0, 3);
  return RESERVED.has(s) ? s + "x" : s;
}
export const isReserved = (s: string) => RESERVED.has(s);

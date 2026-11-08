import { clearHostSession } from "@/lib/auth";
import { route, json } from "@/lib/api";
export const POST = route(async () => { await clearHostSession(); return json({ ok: true }); });

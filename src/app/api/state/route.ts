import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readDB } from "@/lib/store";
import { SESSION_COOKIE } from "@/lib/session";
import { grokMode } from "@/lib/grok";
import { integrations } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const meId = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  return NextResponse.json({ db: readDB(), meId, mode: grokMode(), integrations: integrations() });
}

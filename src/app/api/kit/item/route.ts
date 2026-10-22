import { NextResponse } from "next/server";
import { regenerateItem } from "@/lib/services";
import { updateItem } from "@/lib/kit";
import { mutate } from "@/lib/store";
import type { KitKey } from "@/lib/types";

export async function POST(req: Request) {
  const { eventId, key, action, data } = (await req.json()) as { eventId: string; key: KitKey; action: "approve" | "unapprove" | "edit" | "regenerate"; data?: unknown };
  if (action === "regenerate") return NextResponse.json({ ok: await regenerateItem(eventId, key) });
  const ok = mutate((db) => updateItem(db, eventId, key, action === "edit" ? { data } : { status: action === "approve" ? "approved" : "draft" }));
  return NextResponse.json({ ok });
}

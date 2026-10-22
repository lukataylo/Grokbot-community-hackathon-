import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentAttendee } from "@/lib/session";
import { tagPhotos } from "@/lib/services";
import { addPhoto } from "@/lib/engine";
import { mutate, uid } from "@/lib/store";

export async function POST(req: Request) {
  const me = await currentAttendee();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const caption = String(form.get("caption") || "Event moment");
  const dir = path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const ids: string[] = [];
  for (const file of files) {
    const id = uid("p");
    const ext = (path.extname(file.name) || ".jpg").toLowerCase();
    fs.writeFileSync(path.join(dir, id + ext), Buffer.from(await file.arrayBuffer()));
    ids.push(id);
    mutate((db) => addPhoto(db, me, { id, url: `/uploads/${id}${ext}`, caption, takenAt: file.lastModified }));
  }
  await tagPhotos(me.eventId, ids);
  return NextResponse.json({ ids });
}

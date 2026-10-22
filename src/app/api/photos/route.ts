import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentAttendee } from "@/lib/session";
import { tagPhotos } from "@/lib/services";
import { logActivity, mutate, uid } from "@/lib/store";

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
    mutate((db) => {
      db.photos.unshift({
        id, eventId: me.eventId, url: `/uploads/${id}${ext}`, uploaderId: me.id, caption,
        takenAt: new Date(file.lastModified || Date.now()).toISOString(), uploadedAt: new Date().toISOString(),
        status: "pending", tags: [], withheld: [], hidden: false,
      });
      logActivity(db, { eventId: me.eventId, kind: "upload", text: `@${me.xHandle} uploaded "${caption}"`, attendeeId: me.id });
    });
  }
  await tagPhotos(me.eventId, ids);
  return NextResponse.json({ ids });
}

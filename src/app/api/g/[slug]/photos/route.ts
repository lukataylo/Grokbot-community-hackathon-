import { route, json, requireGuest, HttpError, limit, form } from "@/lib/api";
import { acceptPhotos } from "@/lib/uploads";

type Ctx = { params: Promise<{ slug: string }> };
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  if (ev.uploads === "hosts") throw new HttpError(403, "Only the hosts are adding photos at this event");
  // Uploads stay open after the morning round-up, but not past the retention window: those would be deleted at once.
  if (ev.delivered_at && Date.now() > new Date(ev.delivered_at).getTime() + ev.retention_days * 86400_000) throw new HttpError(403, "This event's photos have been deleted. Uploads are closed.");
  limit("upload:" + g.id, 20, 60_000);
  return json({ ids: await acceptPhotos(ev.id, g.id, false, await form(req)) }, 201);
});

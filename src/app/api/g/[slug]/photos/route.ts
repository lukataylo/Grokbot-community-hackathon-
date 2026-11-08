import { route, json, requireGuest, HttpError, limit } from "@/lib/api";
import { acceptPhotos } from "@/lib/uploads";

type Ctx = { params: Promise<{ slug: string }> };
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev, g } = await requireGuest((await params).slug);
  if (ev.uploads === "hosts") throw new HttpError(403, "Only the hosts are adding photos at this event");
  if (ev.delivered_at) throw new HttpError(403, "Photos have been delivered. Uploads are closed.");
  limit("upload:" + g.id, 20, 60_000);
  return json({ ids: await acceptPhotos(ev.id, g.id, false, await req.formData()) }, 201);
});

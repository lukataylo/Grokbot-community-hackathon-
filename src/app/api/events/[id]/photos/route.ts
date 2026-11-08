import { route, json, requireHostEvent } from "@/lib/api";
import { acceptPhotos } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { ev } = await requireHostEvent((await params).id);
  return json({ ids: await acceptPhotos(ev.id, null, true, await req.formData()) }, 201);
});

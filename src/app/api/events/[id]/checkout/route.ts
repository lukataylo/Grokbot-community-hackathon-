import { route, json, requireHostEvent, HttpError } from "@/lib/api";
import { checkoutForEvent } from "@/lib/stripe";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { h, ev } = await requireHostEvent((await params).id);
  if (ev.sharing_unlocked) throw new HttpError(409, "Sharing is already unlocked for this event");
  const s = await checkoutForEvent({ id: ev.id, name: ev.name }, h.email);
  return json({ url: s.url });
});

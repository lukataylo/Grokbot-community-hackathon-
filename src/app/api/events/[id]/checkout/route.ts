import { route, json, requireHostEvent, HttpError } from "@/lib/api";
import { checkoutForEvent } from "@/lib/stripe";
import { claimFreeShare } from "@/lib/freeshare";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { h, ev } = await requireHostEvent((await params).id);
  if (ev.sharing_unlocked) throw new HttpError(409, "Sharing is already unlocked for this event");
  // A host's first event is on us: no checkout at all.
  if (await claimFreeShare(h.id, ev.id)) return json({ free: true });
  const s = await checkoutForEvent({ id: ev.id, name: ev.name }, h.email);
  return json({ url: s.url });
});

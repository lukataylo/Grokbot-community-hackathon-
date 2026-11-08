import { route, json, requireHostEvent } from "@/lib/api";
import { deliverEvent } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { ev } = await requireHostEvent((await params).id);
  await deliverEvent(ev.id);
  return json({ ok: true });
});

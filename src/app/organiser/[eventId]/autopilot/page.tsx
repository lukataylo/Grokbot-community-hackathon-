import { EVENT_ID } from "@/lib/seed";
import { AutopilotView } from "@/views/autopilot";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <AutopilotView eventId={(await params).eventId} />;
}

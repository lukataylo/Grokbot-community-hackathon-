import { EVENT_ID } from "@/lib/seed";
import { ReplayView } from "@/views/replay";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <ReplayView eventId={(await params).eventId} />;
}

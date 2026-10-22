import { EVENT_ID } from "@/lib/seed";
import { JoinView } from "@/views/join";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <JoinView eventId={(await params).eventId} />;
}

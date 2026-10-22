import { EVENT_ID } from "@/lib/seed";
import { MeView } from "@/views/me";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <MeView eventId={(await params).eventId} />;
}

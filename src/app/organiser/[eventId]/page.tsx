import { EVENT_ID } from "@/lib/seed";
import { OrganiserView } from "@/views/organiser";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <OrganiserView eventId={(await params).eventId} />;
}

import { EVENT_ID } from "@/lib/seed";
import { PlanView } from "@/views/plan";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <PlanView eventId={(await params).eventId} />;
}

import { EVENT_ID } from "@/lib/seed";
import { LeaderboardView } from "@/views/leaderboard";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <LeaderboardView eventId={(await params).eventId} />;
}

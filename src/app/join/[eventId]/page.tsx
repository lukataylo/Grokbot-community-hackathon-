import { notFound } from "next/navigation";
import { readDB } from "@/lib/store";
import { currentAttendee } from "@/lib/session";
import { JoinForm } from "@/components/actions";
import { GrokMark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = readDB().events.find((e) => e.id === eventId);
  if (!event) notFound();
  const me = await currentAttendee();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-black">
            <GrokMark />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wider text-fuchsia-300">You&apos;re checking in to</p>
            <h1 className="text-lg font-bold leading-tight">{event.name}</h1>
            <p className="text-xs text-zinc-500">
              {event.venue} · {event.hashtag}
            </p>
          </div>
        </div>
        <JoinForm eventId={eventId} initial={me?.eventId === eventId ? me : undefined} />
      </div>
      <p className="mt-4 text-center text-xs text-zinc-500">Grokbot only tags people who said yes. You can change consent any time.</p>
    </main>
  );
}

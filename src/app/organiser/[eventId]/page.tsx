import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { readDB } from "@/lib/store";
import { leaderboard } from "@/lib/points";
import { Nav } from "@/components/nav";
import { ActionButton, AutoRefresh, BotConsole } from "@/components/actions";
import { Avatar, GrokMark, relTime } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_ICON = { join: "🎟", upload: "📷", tag: "🏷", task: "🚀", bot: "🤖", plan: "🗓" } as const;

export default async function Organiser({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const db = readDB();
  const event = db.events.find((e) => e.id === eventId)!;
  const h = await headers();
  const origin = process.env.PUBLIC_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const joinUrl = `${origin}/join/${eventId}`;
  const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320, color: { dark: "#000000", light: "#ffffff" } });
  const people = db.attendees.filter((a) => a.eventId === eventId);
  const photos = db.photos.filter((p) => p.eventId === eventId);
  const tasks = db.tasks.filter((t) => t.eventId === eventId);
  const done = tasks.filter((t) => t.status === "done");
  const reach = leaderboard(db, eventId).reduce((s, x) => s + x.reach, 0);
  const pending = photos.filter((p) => p.status === "pending").length;
  const stats = [
    ["Attendees", people.length, `${people.filter((a) => a.consentTag).length} opted into tagging`],
    ["Photos", photos.length, `${pending} waiting for Grok`],
    ["Tags delivered", photos.reduce((s, p) => s + p.tags.length, 0), `${photos.reduce((s, p) => s + p.withheld.length, 0)} withheld for consent`],
    ["Share tasks", `${done.length}/${tasks.length}`, "done / planned"],
    ["Est. reach", reach.toLocaleString(), "followers reached"],
  ];
  return (
    <>
      <Nav eventId={eventId} active="organiser" />
      <AutoRefresh ms={4000} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-fuchsia-300">Organiser · @{event.organiserHandle}</p>
            <h1 className="text-3xl font-bold">{event.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton url="/api/tag" body={{ eventId }} label={<><GrokMark className="h-4 w-4" /> Run Grok tagging{pending ? ` (${pending})` : ""}</>} busyLabel="Grok is looking…" />
            <ActionButton url="/api/plan" body={{ eventId }} label={<><GrokMark className="h-4 w-4" /> Generate share plan</>} busyLabel="Planning…" />
            <ActionButton url="/api/reset" label="Reset demo" className="btn-ghost" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          {stats.map(([label, value, sub]) => (
            <div key={label as string} className="card p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
              <p className="mt-1 text-3xl font-black">{value}</p>
              <p className="text-xs text-zinc-500">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr_1fr]">
          <div className="card flex flex-col items-center p-5 text-center">
            <p className="mb-3 font-semibold">Scan to join</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Join QR code" className="w-52 rounded-xl" />
            <Link href={`/join/${eventId}`} className="mt-3 break-all text-xs text-fuchsia-300 hover:underline">
              {joinUrl}
            </Link>
          </div>
          <BotConsole eventId={eventId} />
          <div className="card p-4">
            <h3 className="mb-3 font-semibold">Live activity</h3>
            <ul className="space-y-2 overflow-y-auto text-sm" style={{ maxHeight: 330 }}>
              {db.activity.filter((a) => a.eventId === eventId).slice(0, 25).map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span>{KIND_ICON[a.kind]}</span>
                  <span className="flex-1 text-zinc-300">{a.text}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{relTime(a.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Attendees & consent</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-black/30 p-2 text-sm">
                <Avatar a={a} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name} <span className="text-zinc-500">@{a.xHandle}</span></p>
                  <p className="truncate text-xs text-zinc-500">{a.lookFor || "no description"}</p>
                </div>
                <span title="photo consent">{a.consentPhoto ? "📷" : "🚫"}</span>
                <span title="tag consent">{a.consentTag ? "🏷" : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

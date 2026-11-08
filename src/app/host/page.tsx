import { currentHost } from "@/lib/auth";
import { sql, migrate } from "@/lib/db";
import SignIn from "@/components/host/SignIn";
import { Logo } from "@/components/ui";
import { fmt } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host" };

export default async function HostHome({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  await migrate();
  const h = await currentHost();
  if (!h) return <SignIn expired={!!(await searchParams).expired} />;
  const events = await sql`select e.id, e.name, e.starts_at, e.timezone, e.delivered_at, e.sharing_unlocked,
      (select count(*)::int from guests g where g.event_id = e.id) as guests, (select count(*)::int from photos p where p.event_id = e.id) as photos
    from events e where host_id = ${h.id} order by starts_at desc`;
  return (
    <main className="shell">
      <div className="top"><Logo href="/host" /><span>{h.email}</span></div>
      <div className="row between" style={{ marginTop: 12 }}><h1>Your events</h1></div>
      {events.length === 0 && <p>No events yet. Set one up in a couple of minutes; it&apos;s free.</p>}
      <div className="list">
        {events.map((e) => (
          <a key={e.id} className="li" href={`/host/e/${e.id}`} style={{ textDecoration: "none" }}>
            <span><span className="ink">{e.name}</span><small>{fmt(e.starts_at, e.timezone, { weekday: "short", day: "numeric", month: "short" })} · {e.guests} guests · {e.photos} photos{e.sharing_unlocked ? " · sharing on" : ""}</small></span>
            <span className="small">{e.delivered_at ? "Delivered" : new Date(e.starts_at) > new Date() ? "Upcoming" : "Live"} ›</span>
          </a>
        ))}
      </div>
      <div className="grow" />
      <a className="btn" href="/host/new">New event</a>
    </main>
  );
}

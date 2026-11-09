import { currentHost } from "@/lib/auth";
import { sql, migrate } from "@/lib/db";
import SignIn from "@/components/host/SignIn";
import { Logo, Rays } from "@/components/ui";
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
      <div className="top"><Logo href="/host" /><form method="post" action="/api/host/logout"><button className="link" title={h.email}>Sign out</button></form></div>
      <h1 style={{ marginTop: 12 }}>Your events</h1>
      {events.length === 0 && <div className="moment"><Rays spin style={{ width: 200, height: 200 }} /><h2>No events yet.</h2><p>It&apos;s free to run one.</p></div>}
      <div className="list" style={events.length ? { borderTop: "1.5px solid var(--ink)" } : undefined}>
        {events.map((e) => (
          <a key={e.id} className="li" href={`/host/e/${e.id}`} style={{ textDecoration: "none" }}>
            <span><span className="ink" style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.03em" }}>{e.name}</span><small>{fmt(e.starts_at, e.timezone, { weekday: "short", day: "numeric", month: "short" })} · {e.guests} guests · {e.photos} photos{e.sharing_unlocked ? " · sharing on" : ""}</small></span>
            <span className="small">{e.delivered_at ? "Delivered" : new Date(e.starts_at) > new Date() ? "Upcoming" : "Live"} ›</span>
          </a>
        ))}
      </div>
      <div className="grow" />
      <a className="btn" href="/host/new">New event</a>
    </main>
  );
}

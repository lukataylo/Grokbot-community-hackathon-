import { redirect } from "next/navigation";
import { currentHost } from "@/lib/auth";
import { migrate } from "@/lib/db";
import Setup from "@/components/host/Setup";
import { inBeta } from "@/lib/env";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "New event" };

export default async function NewEvent() {
  await migrate();
  const h = await currentHost();
  if (!h) redirect("/host");
  if (!inBeta(h.email)) return (
    <main className="shell">
      <div className="top"><Logo href="/host" /></div>
      <div className="grow" />
      <h1>Lumzel is in private beta.</h1>
      <p>New events are open to invited hosts for now. Register your interest and we&apos;ll be in touch.</p>
      <div className="grow" />
      <a className="btn" href="/#interest">Register interest</a>
    </main>
  );
  return <Setup hostName={h.name ?? ""} />;
}

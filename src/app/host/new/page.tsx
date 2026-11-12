import { redirect } from "next/navigation";
import { currentHost } from "@/lib/auth";
import { migrate } from "@/lib/db";
import Setup from "@/components/host/Setup";
import { canHost } from "@/lib/beta";
import { Logo } from "@/components/ui";
import { hasFreeShare } from "@/lib/freeshare";

export const dynamic = "force-dynamic";
export const metadata = { title: "New event" };

export default async function NewEvent() {
  await migrate();
  const h = await currentHost();
  if (!h) redirect("/host");
  if (!(await canHost(h.email))) return (
    <main className="shell">
      <div className="top"><Logo href="/host" /></div>
      <div className="grow" />
      <h1>Get beta access first.</h1>
      <p>Enter your email on the home page and you can create events straight away.</p>
      <div className="grow" />
      <a className="btn" href="/#interest">Get beta access</a>
    </main>
  );
  return <Setup hostName={h.name ?? ""} firstFree={await hasFreeShare(h.id)} />;
}

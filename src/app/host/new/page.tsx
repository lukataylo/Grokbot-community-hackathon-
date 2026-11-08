import { redirect } from "next/navigation";
import { currentHost } from "@/lib/auth";
import { migrate } from "@/lib/db";
import Setup from "@/components/host/Setup";

export const dynamic = "force-dynamic";
export const metadata = { title: "New event" };

export default async function NewEvent() {
  await migrate();
  const h = await currentHost();
  if (!h) redirect("/host");
  return <Setup hostName={h.name ?? ""} />;
}

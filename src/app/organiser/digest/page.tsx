import { EVENT_ID } from "@/lib/seed";
import { DigestView } from "@/views/digest";

export default function Page() {
  return <DigestView eventId={EVENT_ID} />;
}

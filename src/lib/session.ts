import { cookies } from "next/headers";
import { readDB } from "./store";

export const SESSION_COOKIE = "gb_attendee";

export async function currentAttendee() {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return readDB().attendees.find((a) => a.id === id) ?? null;
}

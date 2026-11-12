import { sql } from "./db";

/**
 * A host's first event gets social sharing free. One per host account, ever: once used it stays used even if that
 * event is deleted, and a host who has already paid for an event has had their first.
 */
export async function hasFreeShare(hostId: string): Promise<boolean> {
  const [r] = await sql`select (h.free_used_at is null and not exists (select 1 from events e where e.host_id = h.id and e.paid_at is not null)) as ok
    from hosts h where h.id = ${hostId}`;
  return !!r?.ok;
}

/** Switches sharing on for this event at no charge, if the host still has their free one. Safe against double taps. */
export async function claimFreeShare(hostId: string, eventId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [mine] = await tx`update hosts h set free_used_at = now(), free_event_id = ${eventId}
      where h.id = ${hostId} and h.free_used_at is null and not exists (select 1 from events e where e.host_id = h.id and e.paid_at is not null)
      returning h.id`;
    if (!mine) return false;
    await tx`update events set sharing_unlocked = true, paid_at = coalesce(paid_at, now()), amount_paid = 0 where id = ${eventId} and host_id = ${hostId}`;
    return true;
  });
}

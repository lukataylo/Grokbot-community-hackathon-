/** Wall-clock time in a zone → UTC Date, without a tz library. */
export function zoned(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  let t = guess - offset(guess);
  t = guess - offset(t);
  return new Date(t);
}
export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export const fmt = (d: Date | string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...o }).format(new Date(d));

/** Start, end and the morning-after delivery time for an event. */
export function schedule(i: { date: string; start: string; end: string; deliver: string; timezone: string }) {
  const startsAt = zoned(i.date, i.start, i.timezone);
  const endDate = i.end <= i.start ? addDays(i.date, 1) : i.date;
  const endsAt = zoned(endDate, i.end, i.timezone);
  const deliverAt = zoned(addDays(i.date, 1), i.deliver, i.timezone);
  return { startsAt, endsAt, deliverAt: deliverAt > endsAt ? deliverAt : new Date(endsAt.getTime() + 3600_000) };
}

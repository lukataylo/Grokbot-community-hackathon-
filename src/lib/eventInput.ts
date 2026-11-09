import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 19:30");
const realDate = (s: string) => {
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(+d) && d.toISOString().slice(0, 10) === s && +d < Date.now() + 2 * 365 * 864e5; // within two years
};
const realZone = (tz: string) => { try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return true; } catch { return false; } };
export const EventInput = z.object({
  name: z.string().trim().min(2).max(80),
  hostedBy: z.string().trim().max(80).default(""),
  venue: z.string().trim().max(120).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(realDate, "Pick a real date within the next two years"),
  start: hhmm, end: hhmm, deliver: hhmm.default("07:30"),
  timezone: z.string().max(60).refine(realZone, "Unknown time zone").default("Europe/London"),
  linkedin: z.string().trim().max(80).default(""),
  x: z.string().trim().max(40).default(""),
  hashtag: z.string().trim().max(40).default(""),
  captionTemplate: z.string().trim().max(500).default(""),
  description: z.string().trim().max(1200).default(""),
  highlights: z.string().trim().max(1200).default(""),
  uploads: z.enum(["everyone", "hosts"]).default("everyone"),
  retentionDays: z.coerce.number().int().refine((n) => [7, 30, 90].includes(n)).default(30),
});
export type EventInput = z.infer<typeof EventInput>;

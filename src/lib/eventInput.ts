import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
export const EventInput = z.object({
  name: z.string().trim().min(2).max(80),
  hostedBy: z.string().trim().max(80).default(""),
  venue: z.string().trim().max(120).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: hhmm, end: hhmm, deliver: hhmm.default("07:30"),
  timezone: z.string().max(60).default("Europe/London"),
  expectedGuests: z.coerce.number().int().min(1).max(5000).default(100),
  linkedin: z.string().trim().max(80).default(""),
  x: z.string().trim().max(40).default(""),
  hashtag: z.string().trim().max(40).default(""),
  captionTemplate: z.string().trim().max(500).default(""),
  description: z.string().trim().max(1200).default(""),
  highlights: z.string().trim().max(1200).default(""),
  reviewMode: z.enum(["host_then_auto", "auto"]).default("host_then_auto"),
  uploads: z.enum(["everyone", "hosts"]).default("everyone"),
  retentionDays: z.coerce.number().int().refine((n) => [7, 30, 90].includes(n)).default(30),
});
export type EventInput = z.infer<typeof EventInput>;

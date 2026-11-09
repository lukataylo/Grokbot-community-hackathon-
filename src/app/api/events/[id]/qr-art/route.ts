import crypto from "crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import * as store from "@/lib/storage";
import { env } from "@/lib/env";
import { route, json, requireHostEvent, HttpError, limit } from "@/lib/api";
import { artState, generateCandidates, joinUrl, themesFor, MAX_RUNS, MAX_HOST_RUNS, DAILY_RUNS, type QrEvent } from "@/lib/qrart";

type Ctx = { params: Promise<{ id: string }> };
const running = new Set<string>(); // one paid run per event at a time (single instance)
const USED_UP = "You've used every artistic QR try for this event.";

/**
 * Makes up to three artistic candidates and keeps the ones that scan. Each image is paid for, so a run is
 * claimed against three caps before any money is spent (per event, per host, whole service per day), and a
 * claimed run is never refunded: a failed model call may still have been billed.
 */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { h, ev: raw } = await requireHostEvent((await params).id);
  const ev = raw as QrEvent;
  if (!env.openrouterKey) throw new HttpError(503, "Artistic QR codes aren't available right now.");
  if (running.has(ev.id)) throw new HttpError(409, "Already making your art. Give it a minute.");
  running.add(ev.id);
  try {
    limit(`qrart:${h.id}`, 2, 3600_000);
    const claimed = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('qrart-runs'))`; // serialise the cap checks
      const [{ host, day }] = await tx`select
          (select coalesce(sum(qr_art_runs), 0)::int from events where host_id = ${h.id}) as host,
          (select count(*)::int from qr_art_run where created_at > now() - interval '1 day') as day`;
      if (host >= MAX_HOST_RUNS) throw new HttpError(429, "You've used every artistic QR try on your account. Email hello@lumzel.com for more.");
      if (day >= DAILY_RUNS) throw new HttpError(429, "Artistic QR codes are busy today. Try again tomorrow.");
      const [ok] = await tx`update events set qr_art_runs = qr_art_runs + 1 where id = ${ev.id} and qr_art_runs < ${MAX_RUNS} returning id`;
      if (ok) await tx`insert into qr_art_run (event_id) values (${ev.id})`;
      return !!ok;
    });
    if (!claimed) throw new HttpError(429, USED_UP);

    const url = joinUrl(ev.slug);
    let result;
    try { result = await generateCandidates(url, await themesFor(ev)); }
    catch (e) { console.warn("[qrart]", (e as Error).message); throw new HttpError(502, "The art generator didn't respond. Try again in a few minutes."); }
    for (const c of result.passed) {
      const id = crypto.randomUUID();
      const key = `e/${ev.id}/qr/${id}.png`;
      await store.put(key, c.png, "image/png");
      await sql`insert into qr_art (id, event_id, key, theme, url) values (${id}, ${ev.id}, ${key}, ${c.theme}, ${url})`;
    }
    const [fresh] = await sql`select * from events where id = ${ev.id}`;
    return json({ ...(await artState(fresh as QrEvent)), made: result.passed.length, rejected: result.failed });
  } finally { running.delete(ev.id); }
});

const Choose = z.object({ artId: z.uuid().nullable() });

/** Picks a candidate for the screen and poster, or null for the plain QR. Only art for today's join URL. */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const ev = (await requireHostEvent((await params).id)).ev as QrEvent;
  const { artId } = Choose.parse(await req.json());
  let key: string | null = null;
  if (artId) {
    const [a] = await sql`select key from qr_art where id = ${artId} and event_id = ${ev.id} and url = ${joinUrl(ev.slug)}`;
    if (!a) throw new HttpError(404, "That design is gone. Make a new one.");
    key = a.key;
  }
  await sql`update events set qr_art_key = ${key} where id = ${ev.id}`;
  return json({ ok: true, chosen: artId });
});

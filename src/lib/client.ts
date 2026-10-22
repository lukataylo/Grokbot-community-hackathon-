"use client";

import { useEffect, useSyncExternalStore } from "react";
import { addPhoto, applyTags, mockRecap, botCommand, botContext, buildPlan, completeTask, joinEvent, logActivity, logBot, mockBotAnswer, mockIdentify, savePlan, uid, type JoinInput } from "./engine";
import { approveAll, approvePlan, getKit, kitMarkdown, markPublished, mockAnnouncement, mockItem, mockKit, saveKit, setBrand, updateItem } from "./kit";
import { mockDigest, parseIcs, sampleIcs, thisWeek, updateDigest } from "./digest";
import { buildSeed } from "./seed";
import { parseSceneUrl, renderScene } from "./scene";
import type { Brand, DB, KitKey, Photo } from "./types";

/**
 * Static mode (NEXT_PUBLIC_STATIC_DEMO=1) runs the whole app in the browser against a
 * localStorage copy of the seed data, so it can be hosted on GitHub Pages.
 * Otherwise every call goes to the Next.js API routes.
 */
export const STATIC = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const DB_KEY = "gb_db_v1";
const SESSION_KEY = "gb_session";

export interface AppState {
  db: DB;
  meId: string | null;
  mode: "grok" | "mock";
  integrations?: { ghost: boolean; discord: boolean; notion: boolean };
}

let state: AppState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function loadLocal(): DB {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    const db = JSON.parse(raw) as DB;
    db.kits ??= {};
    return db;
  }
  const seed = buildSeed();
  localStorage.setItem(DB_KEY, JSON.stringify(seed));
  return seed;
}

function local<T>(fn: (db: DB) => T): T {
  const db = loadLocal();
  const out = fn(db);
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    alert("Browser storage is full. Use Reset demo on the organiser page.");
  }
  return out;
}

export async function refresh() {
  if (STATIC) state = { db: loadLocal(), meId: localStorage.getItem(SESSION_KEY), mode: "mock" };
  else state = (await (await fetch(`${BASE}/api/state`, { cache: "no-store" })).json()) as AppState;
  emit();
}

export function useAppData(pollMs = 0) {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => null,
  );
  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [pollMs]);
  return s;
}

async function post(url: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  return res.json();
}

function tagLocal(db: DB, eventId: string, ids: string[]) {
  const roster = db.attendees.filter((a) => a.eventId === eventId);
  for (const id of ids) {
    const p = db.photos.find((x) => x.id === id)!;
    const svg = p.url.startsWith("data:image/svg") ? decodeURIComponent(p.url.split(",")[1]) : undefined;
    applyTags(db, eventId, id, mockIdentify(p, roster, svg));
  }
  return ids.length;
}

async function fileToUrl(file: File): Promise<string> {
  if (file.type === "image/svg+xml") return `data:image/svg+xml;utf8,${encodeURIComponent(await file.text())}`;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

export const api = {
  async join(body: JoinInput) {
    if (!STATIC) return (await post("/api/join", body)).attendee;
    const a = local((db) => joinEvent(db, body));
    if (a) localStorage.setItem(SESSION_KEY, a.id);
    return a;
  },
  async login(attendeeId: string | null) {
    if (!STATIC) await post("/api/login", { attendeeId });
    else if (attendeeId) localStorage.setItem(SESSION_KEY, attendeeId);
    else localStorage.removeItem(SESSION_KEY);
    await refresh();
  },
  async upload(files: File[], caption: string) {
    if (!STATIC) {
      const fd = new FormData();
      for (const f of files) fd.append("file", f);
      fd.append("caption", caption);
      await fetch(`${BASE}/api/photos`, { method: "POST", body: fd });
    } else {
      const meId = localStorage.getItem(SESSION_KEY);
      const urls = await Promise.all(files.map(fileToUrl));
      local((db) => {
        const me = db.attendees.find((a) => a.id === meId);
        if (!me) return;
        const ids = urls.map((url) => {
          const id = uid("p");
          addPhoto(db, me, { id, url, caption });
          return id;
        });
        tagLocal(db, me.eventId, ids);
      });
    }
    await refresh();
  },
  async tag(eventId: string) {
    if (!STATIC) await post("/api/tag", { eventId });
    else local((db) => tagLocal(db, eventId, db.photos.filter((p) => p.eventId === eventId && p.status === "pending").map((p) => p.id)));
    await refresh();
  },
  async plan(eventId: string) {
    if (!STATIC) await post("/api/plan", { eventId });
    else local((db) => savePlan(db, eventId, buildPlan(db, eventId), "mock"));
    await refresh();
  },
  async completeTask(id: string) {
    if (!STATIC) await post(`/api/tasks/${id}`);
    else local((db) => completeTask(db, id));
    await refresh();
  },
  async bot(eventId: string, command: string): Promise<string> {
    let reply: string;
    if (!STATIC) reply = (await post("/api/bot", { eventId, command })).reply;
    else
      reply = local((db) => {
        const cmd = command.trim().split(/\s+/)[0].toLowerCase();
        let r = botCommand(db, eventId, command);
        if (r === null) {
          if (cmd === "/tag") r = `Tagged ${tagLocal(db, eventId, db.photos.filter((p) => p.eventId === eventId && p.status === "pending").map((p) => p.id))} new photos. Consent rules applied.`;
          else if (cmd === "/plan") r = `Sharing plan ready: ${savePlan(db, eventId, buildPlan(db, eventId), "mock")} tasks drafted. Approve it on the Plan tab to send them to attendees.`;
          else r = mockBotAnswer(botContext(db, eventId));
        }
        logBot(db, eventId, command, r);
        return r;
      });
    await refresh();
    return reply;
  },
  async generateKit(body: { eventId: string; idea: string; dump: string; luma: string; brand?: Brand }) {
    if (!STATIC) {
      const r = await post("/api/kit", body);
      await refresh();
      return r as { source?: string; luma?: { ok: boolean }; error?: string };
    }
    const kit = mockKit({ ...body, luma: body.luma.trim() ? { id: body.luma.trim(), facts: null } : undefined });
    local((db) => saveKit(db, kit));
    await refresh();
    return { source: kit.source, luma: kit.luma };
  },
  async kitItem(eventId: string, key: KitKey, action: "approve" | "unapprove" | "edit" | "regenerate", data?: unknown) {
    if (!STATIC) await post("/api/kit/item", { eventId, key, action, data });
    else
      local((db) => {
        const kit = getKit(db, eventId);
        if (!kit) return;
        if (action === "regenerate") updateItem(db, eventId, key, { regenerated: mockItem(kit, key, kit.items[key].variant + 1) });
        else updateItem(db, eventId, key, action === "edit" ? { data } : { status: action === "approve" ? "approved" : "draft" });
      });
    await refresh();
  },
  async publishKit(eventId: string, all: boolean): Promise<{ count: number; errors: string[] }> {
    let r: { count: number; errors: string[] };
    if (!STATIC) r = await post("/api/kit/publish", { eventId, all });
    else
      r = local((db) => {
        if (all) approveAll(db, eventId);
        return { count: markPublished(db, eventId), errors: [] };
      });
    await refresh();
    return r;
  },
  async setBrand(eventId: string, brand: Brand) {
    if (!STATIC) await post("/api/kit/brand", { eventId, brand });
    else local((db) => setBrand(db, eventId, brand));
    await refresh();
  },
  async exportNotion(eventId: string): Promise<{ ok: boolean; url?: string; markdown?: string; error?: string }> {
    if (!STATIC) return post("/api/kit/notion", { eventId });
    const kit = getKit(loadLocal(), eventId);
    return { ok: false, markdown: kit && kitMarkdown(kit) };
  },
  async approvePlan(eventId: string) {
    if (!STATIC) await post("/api/plan/approve", { eventId });
    else local((db) => approvePlan(db, eventId));
    await refresh();
  },
  async announce(eventId: string, change: string): Promise<{ text: string; via: string }> {
    let r: { text: string; via: string };
    if (!STATIC) r = await post("/api/announce", { eventId, change });
    else
      r = local((db) => {
        const name = getKit(db, eventId)?.facts.name ?? db.events.find((e) => e.id === eventId)?.name ?? "tonight";
        const text = mockAnnouncement(change, name);
        logActivity(db, { eventId, kind: "announce", text: `Pushed update (WhatsApp share link): ${text.slice(0, 120)}` });
        return { text, via: "WhatsApp share link" };
      });
    await refresh();
    return r;
  },
  async digest(calendar: string, community: string): Promise<{ feed: string; events: number }> {
    let r: { feed: string; events: number };
    if (!STATIC) r = await post("/api/digest", { calendar, community });
    else
      r = local((db) => {
        db.digest = mockDigest(calendar, "sample", thisWeek(parseIcs(sampleIcs())), community);
        return { feed: "sample", events: db.digest.events.length };
      });
    await refresh();
    return r;
  },
  async digestItem(part: "newsletter" | "whatsapp", patch: { status?: "draft" | "approved" | "sent"; text?: string; subject?: string }) {
    if (!STATIC) await post("/api/digest/item", { part, ...patch });
    else local((db) => updateDigest(db, part, patch));
    await refresh();
  },
  async recap(eventId: string): Promise<{ x: string; linkedin: string } | null> {
    if (!STATIC) return (await post("/api/recap", { eventId })).recap ?? null;
    const db = loadLocal();
    const meId = localStorage.getItem(SESSION_KEY);
    return meId ? mockRecap(db, eventId, meId) : null;
  },
  async reset() {
    if (!STATIC) await post("/api/reset");
    else localStorage.setItem(DB_KEY, JSON.stringify(buildSeed()));
    await refresh();
  },
};

export function photoSrc(photo: Photo, db: DB) {
  if (photo.url.startsWith("/scene/")) {
    if (!STATIC) return `${BASE}${photo.url}`;
    const { id, bg, who } = parseSceneUrl(photo.url);
    const people = who.map((w) => db.attendees.find((a) => a.id === w)).filter((a) => !!a);
    return `data:image/svg+xml;utf8,${encodeURIComponent(renderScene(id, bg, people))}`;
  }
  return photo.url.startsWith("/") ? `${BASE}${photo.url}` : photo.url;
}

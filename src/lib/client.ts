"use client";

import { useEffect, useSyncExternalStore } from "react";
import { addPhoto, applyTags, botCommand, botContext, buildPlan, completeTask, joinEvent, logBot, mockBotAnswer, mockIdentify, savePlan, uid, type JoinInput } from "./engine";
import { buildSeed } from "./seed";
import { parseSceneUrl, renderScene } from "./scene";
import type { DB, Photo } from "./types";

/**
 * Static mode (NEXT_PUBLIC_STATIC_DEMO=1) runs the whole app in the browser against a
 * localStorage copy of the seed data, so it can be hosted on GitHub Pages.
 * Otherwise every call goes to the Next.js API routes.
 */
export const STATIC = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const DB_KEY = "gb_db_v2";
const SESSION_KEY = "gb_session";

export interface AppState {
  db: DB;
  meId: string | null;
  mode: "grok" | "mock";
}

let state: AppState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function loadLocal(): DB {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) return JSON.parse(raw) as DB;
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
          else if (cmd === "/plan") r = `Sharing plan ready: ${savePlan(db, eventId, buildPlan(db, eventId), "mock")} tasks scheduled. Open the Plan tab.`;
          else r = mockBotAnswer(botContext(db, eventId));
        }
        logBot(db, eventId, command, r);
        return r;
      });
    await refresh();
    return reply;
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

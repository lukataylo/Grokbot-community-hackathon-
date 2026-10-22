import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Activity, DB } from "./types";
import { buildSeed } from "./seed";

/**
 * Local JSON store. Swap for the Supabase adapter (see supabase/schema.sql)
 * by implementing the same read/mutate surface.
 */
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

export function readDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const seed = buildSeed();
    writeDB(seed);
    return seed;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
}

export function writeDB(db: DB) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function mutate<T>(fn: (db: DB) => T): T {
  const db = readDB();
  const out = fn(db);
  writeDB(db);
  return out;
}

export function resetDB() {
  writeDB(buildSeed());
}

export function logActivity(db: DB, a: Omit<Activity, "id" | "at">) {
  db.activity.unshift({ id: randomUUID(), at: new Date().toISOString(), ...a });
  db.activity = db.activity.slice(0, 200);
}

export const uid = (p: string) => `${p}_${randomUUID().slice(0, 8)}`;

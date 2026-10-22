import fs from "node:fs";
import path from "node:path";
import type { DB } from "./types";
import { buildSeed } from "./seed";

export { logActivity, uid } from "./engine";

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
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
  db.kits ??= {};
  return db;
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

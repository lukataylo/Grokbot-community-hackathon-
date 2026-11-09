import postgres from "postgres";
import fs from "fs";
import path from "path";
import { env } from "./env";

type G = { __lzSql?: postgres.Sql; __lzMigrated?: Promise<void> };
const g = globalThis as unknown as G;

export const sql: postgres.Sql =
  g.__lzSql ??
  (g.__lzSql = postgres(env.databaseUrl, {
    max: 10,
    idle_timeout: 30,
    ssl: /localhost|127\.0\.0\.1|\.railway\.internal/.test(env.databaseUrl) ? false : "require",
    transform: { undefined: null },
  }));

export function migrate(): Promise<void> {
  if (!g.__lzMigrated) {
    g.__lzMigrated = (async () => {
      const file = path.join(process.cwd(), "db", "schema.sql");
      await sql.unsafe(fs.readFileSync(file, "utf8"));
    })().catch((e) => { g.__lzMigrated = undefined; throw e; }); // retry on the next request
  }
  return g.__lzMigrated;
}

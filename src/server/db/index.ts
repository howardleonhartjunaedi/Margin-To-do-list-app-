// No "server-only" here: instrumentation and the worker load this outside the RSC layer.
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import * as schema from "./schema";

/*
 * One Postgres dialect everywhere:
 *  - DATABASE_URL set   → a real Postgres server (production, Docker)
 *  - DATABASE_URL unset → embedded PGlite in .data/pglite (local dev, nothing to install)
 * Migrations in ./drizzle run once per process before the first query.
 */

const migrationsFolder = path.join(process.cwd(), "drizzle");

function create() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 10 });
    const db = drizzlePostgres({ client, schema, casing: "snake_case" });
    return { db, ready: migratePostgres(db, { migrationsFolder }) };
  }
  const dir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(path.dirname(dir), { recursive: true }); // PGlite only creates the last segment
  const client = new PGlite(dir);
  const db = drizzlePglite({ client, schema, casing: "snake_case" });

  // PGlite flushes on close. A hard kill (Task Manager, Stop-Process) can leave the
  // data dir unreadable, so close cleanly on Ctrl+C / SIGTERM.
  const close = () => {
    void client.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);

  const ready = migratePglite(db, { migrationsFolder }).catch((e) => {
    if (/Aborted/.test(String(e?.cause?.message ?? e?.message)))
      console.error(
        `\n[db] The embedded database in ${path.relative(process.cwd(), dir)} can't be opened — usually because the server was killed mid-write.\n` +
          `     Move that folder aside (e.g. rename it to pglite-broken) and restart to start fresh,\n` +
          `     or set DATABASE_URL to use a real Postgres for data you want to keep.\n`,
      );
    throw e;
  });
  return { db: db as unknown as PgDb, ready };
}

// Type both drivers as the postgres-js flavour; their query APIs are identical.
type PgDb = PostgresJsDatabase<typeof schema>;

// Opened on first use, never at import time (so `next build` doesn't touch the database),
// and kept on globalThis so dev hot reloads don't open it twice.
const g = globalThis as unknown as { __marginDb?: ReturnType<typeof create> };
const instance = () => (g.__marginDb ??= create());

export const db: PgDb = new Proxy({} as PgDb, {
  get: (_, prop) => Reflect.get(instance().db, prop),
});
/** Await before the first query in any entry point (route handler, page, auth). */
export const dbReady = () => instance().ready;
export { schema };
export type Db = typeof db;

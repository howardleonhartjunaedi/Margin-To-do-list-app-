// No "server-only" here: instrumentation and the worker load this outside the RSC layer.
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { SERVERLESS } from "../site";
import * as schema from "./schema";

/*
 * One Postgres dialect everywhere:
 *  - DATABASE_URL set   → a real Postgres server (production, Docker)
 *  - DATABASE_URL unset → embedded PGlite in .data/pglite or PGLITE_DIR (local dev, nothing to install)
 * Migrations in ./drizzle run once per process before the first query — except on serverless
 * hosts, where the build runs them (scripts/migrate.ts) instead of every cold start.
 */

// Runtime paths: the turbopackIgnore hints stop file tracing from copying the project (and the local
// database) into the server bundle. The Docker image copies ./drizzle in explicitly.
const migrationsFolder = path.join(/* turbopackIgnore: true */ process.cwd(), "drizzle");

function create() {
  // NETLIFY_DATABASE_URL: set by Netlify DB (Neon) when it's added to the site.
  const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;
  if (url) {
    // Transaction-mode poolers (Neon's -pooler host, Supabase's pooler) can't keep prepared statements.
    const pooled = /-pooler.|pooler.supabase.com/.test(url);
    // Each serverless instance serves one request at a time; a few connections is plenty.
    const client = postgres(url, { max: SERVERLESS ? 3 : 10, prepare: !pooled });
    const db = drizzlePostgres({ client, schema, casing: "snake_case" });
    return { db, ready: SERVERLESS ? Promise.resolve() : migratePostgres(db, { migrationsFolder }) };
  }
  if (SERVERLESS) throw new Error("DATABASE_URL is required here: the embedded database needs a disk that lasts between requests.");
  // PGLITE_DIR lets a second local server (e.g. a production build under test) use its own
  // folder: PGlite allows only one process per data directory.
  const dir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.PGLITE_DIR ?? [".data", "pglite"].join(path.sep)); // (built at runtime so the tracer leaves it alone)
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

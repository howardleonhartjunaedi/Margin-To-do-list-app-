// Standalone reminder worker for production with a real Postgres (DATABASE_URL).
// Run: npm run worker   — start as many as you like; they never double-send.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import type { Db } from "../src/server/db/types";
import { startScheduler } from "../src/server/scheduler/start";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. With embedded PGlite the web server runs the scheduler itself.");
  process.exit(1);
}

const client = postgres(url, { max: 4 });
const db = drizzle({ client, schema, casing: "snake_case" }) as Db;
const ready = migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

const stop = startScheduler(async () => (await ready, db), { label: "worker" });
console.log("[worker] reminder scheduler running");

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    stop();
    await client.end({ timeout: 5 });
    process.exit(0);
  });
}

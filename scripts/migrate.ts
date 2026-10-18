// Applies ./drizzle migrations to DATABASE_URL and exits. Netlify runs this before each build,
// since serverless instances skip migrating at startup (see src/server/db/index.ts).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";

// Netlify DB (Neon) provides the direct, unpooled URL too, which suits schema changes best.
const url = process.env.NETLIFY_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;
if (!url) {
  if (process.env.NETLIFY || process.env.PREVIEW === "1") {
    console.log("[migrate] No database configured: building a preview (front page and Try it; no accounts).");
    process.exit(0);
  }
  console.error("[migrate] Set DATABASE_URL (or add Netlify DB) — Margin needs a Postgres database here.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle({ client }), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("[migrate] database is up to date");
} finally {
  await client.end({ timeout: 5 });
}

// The database in the demo worker: PGlite in memory, built from the same migrations.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Db } from "../../server/db/types";
import * as schema from "../../server/db/schema";

/** The SQL of every file in ./drizzle, in order, inlined by scripts/build-demo.mjs. */
declare const __DEMO_MIGRATIONS__: string[];

const client = new PGlite();
export const db = drizzle({ client, schema, casing: "snake_case" }) as unknown as Db;

let ready: Promise<void> | undefined;
export const dbReady = () =>
  (ready ??= (async () => {
    for (const file of __DEMO_MIGRATIONS__) for (const statement of file.split("--> statement-breakpoint")) if (statement.trim()) await client.exec(statement);
  })());
export { schema };

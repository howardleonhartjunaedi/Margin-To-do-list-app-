import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/** Both drivers (postgres-js, PGlite) are typed as this; their query APIs match. */
export type Db = PostgresJsDatabase<typeof schema>;

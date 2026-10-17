/**
 * Starts the reminder scheduler inside the web server process.
 *
 * With embedded PGlite (local dev) this is the only option — one process owns the data dir.
 * With a real Postgres you can instead set SCHEDULER=off here and run `npm run worker`
 * (one or more; they coordinate with SKIP LOCKED).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.SCHEDULER === "off") return;

  const { db, dbReady } = await import("./server/db");
  const { startScheduler } = await import("./server/scheduler/start");
  startScheduler(
    async () => {
      await dbReady();
      return db;
    },
    { label: "in-process" },
  );
}

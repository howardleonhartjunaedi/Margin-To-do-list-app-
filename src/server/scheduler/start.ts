import type { Db } from "../db/types";
import { realChannels } from "./channels";
import { runTick } from "./core";

export const TICK_MS = 15_000;

/**
 * Runs the scheduler every TICK_MS. Ticks never overlap; a slow tick just delays the next.
 * Returns a stop function. Safe to call twice (dev hot reload): the second call is a no-op.
 */
export function startScheduler(getDb: () => Promise<Db>, opts: { baseUrl?: string; label?: string } = {}) {
  const g = globalThis as unknown as { __marginScheduler?: () => void };
  if (g.__marginScheduler) return g.__marginScheduler;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const baseUrl = opts.baseUrl ?? process.env.BETTER_AUTH_URL ?? "";

  const loop = async () => {
    if (stopped) return;
    try {
      const db = await getDb();
      const r = await runTick(db, new Date(), realChannels(db), baseUrl);
      if (r.sent || r.deferred || r.failed || r.digests)
        console.log(`[scheduler${opts.label ? `:${opts.label}` : ""}]`, JSON.stringify(r));
    } catch (e) {
      console.error("[scheduler] tick failed", e);
    }
    if (!stopped) timer = setTimeout(loop, TICK_MS);
  };
  timer = setTimeout(loop, 2_000);

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    g.__marginScheduler = undefined;
  };
  g.__marginScheduler = stop;
  return stop;
}

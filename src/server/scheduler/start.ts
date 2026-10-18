import type { Db } from "../db/types";
import { realChannels } from "./channels";
import { runTick } from "./core";
import { pruneChanges } from "../events";
import { deliverWebhooks } from "../webhooks";
import { siteUrl } from "../site";

export const TICK_MS = 15_000;

/** One scheduler pass: due reminders and digests, pending webhooks, old change notices. */
export async function tickOnce(db: Db, baseUrl = siteUrl(), label?: string) {
  const now = new Date();
  const r = await runTick(db, now, realChannels(db), baseUrl);
  const w = await deliverWebhooks(db, now);
  await pruneChanges(db, now);
  if (w.sent || w.failed) console.log("[webhooks]", JSON.stringify(w));
  if (r.sent || r.deferred || r.failed || r.digests) console.log(`[scheduler${label ? `:${label}` : ""}]`, JSON.stringify(r));
  return { reminders: r, webhooks: w };
}

/**
 * Runs the scheduler every TICK_MS. Ticks never overlap; a slow tick just delays the next.
 * Returns a stop function. Safe to call twice (dev hot reload): the second call is a no-op.
 */
export function startScheduler(getDb: () => Promise<Db>, opts: { baseUrl?: string; label?: string } = {}) {
  const g = globalThis as unknown as { __marginScheduler?: () => void };
  if (g.__marginScheduler) return g.__marginScheduler;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const baseUrl = opts.baseUrl ?? siteUrl();

  const loop = async () => {
    if (stopped) return;
    try {
      await tickOnce(await getDb(), baseUrl, opts.label);
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

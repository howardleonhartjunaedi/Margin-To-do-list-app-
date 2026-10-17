import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { backoffMs, DISABLE_AFTER, MAX_ATTEMPTS, sign } from "@/lib/webhook-sign";
import type { Db } from "./db/types";
import { webhook, webhookDelivery } from "./db/schema";
import { ClientError } from "./errors";
import { WEBHOOK_EVENTS, type WebhookEvent } from "./events";
import { assertPublicUrl } from "./net-guard";

/* ------------------------------ Management ------------------------------ */

const view = (w: typeof webhook.$inferSelect) => ({
  id: w.id,
  url: w.url,
  events: w.events === "*" ? ["*"] : w.events.split(","),
  active: w.active,
  failureCount: w.failureCount,
  lastStatus: w.lastStatus,
  lastDeliveryAt: w.lastDeliveryAt?.toISOString() ?? null,
  createdAt: w.createdAt.toISOString(),
});

export async function listWebhooks(db: Db, userId: string) {
  const rows = await db.select().from(webhook).where(eq(webhook.userId, userId)).orderBy(asc(webhook.createdAt));
  return rows.map(view);
}

function normalizeEvents(events: string[]) {
  if (!events.length || events.includes("*")) return "*";
  const bad = events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
  if (bad.length) throw new ClientError(`Unknown event: ${bad.join(", ")}.`, 422);
  return [...new Set(events)].join(",");
}

export async function createWebhook(db: Db, userId: string, input: { url: string; events: string[] }) {
  const url = await assertPublicUrl(input.url).catch((e: Error) => {
    throw new ClientError(e.message, 422);
  });
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(webhook).where(eq(webhook.userId, userId));
  if (Number(n) >= 10) throw new ClientError("You can have up to 10 webhooks.", 422);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const [row] = await db.insert(webhook).values({ userId, url: url.toString(), secret, events: normalizeEvents(input.events) }).returning();
  return { ...view(row), secret }; // the secret is only ever shown here
}

async function own(db: Db, userId: string, id: string) {
  const [w] = await db.select().from(webhook).where(and(eq(webhook.id, id), eq(webhook.userId, userId)));
  if (!w) throw new ClientError("That webhook doesn’t exist.", 404);
  return w;
}

export async function updateWebhook(db: Db, userId: string, id: string, patch: { events?: string[]; active?: boolean }) {
  await own(db, userId, id);
  const [row] = await db
    .update(webhook)
    .set({
      ...(patch.events ? { events: normalizeEvents(patch.events) } : {}),
      ...(patch.active !== undefined ? { active: patch.active, ...(patch.active ? { failureCount: 0 } : {}) } : {}),
    })
    .where(eq(webhook.id, id))
    .returning();
  return view(row);
}

export async function deleteWebhook(db: Db, userId: string, id: string) {
  await own(db, userId, id);
  await db.delete(webhook).where(eq(webhook.id, id));
}

export async function listDeliveries(db: Db, userId: string, id: string) {
  await own(db, userId, id);
  const rows = await db
    .select()
    .from(webhookDelivery)
    .where(eq(webhookDelivery.webhookId, id))
    .orderBy(desc(webhookDelivery.createdAt))
    .limit(20);
  return rows.map((d) => ({
    id: d.id,
    event: d.event,
    status: d.status,
    attempts: d.attempts,
    responseStatus: d.responseStatus,
    error: d.error,
    createdAt: d.createdAt.toISOString(),
    deliveredAt: d.deliveredAt?.toISOString() ?? null,
  }));
}

/** Queue a "ping" so the user can check their endpoint end to end. */
export async function pingWebhook(db: Db, userId: string, id: string) {
  await own(db, userId, id);
  const did = crypto.randomUUID();
  await db.insert(webhookDelivery).values({
    id: did,
    webhookId: id,
    event: "ping",
    payload: JSON.stringify({ id: did, event: "ping", createdAt: new Date().toISOString(), data: { message: "Hello from Margin." } }),
  });
}

/* ------------------------------ Delivery (run by the scheduler) ------------------------------ */

export type Fetcher = (url: string, init: RequestInit) => Promise<{ status: number }>;

const defaultFetch: Fetcher = async (url, init) => {
  // Re-check at send time: DNS can change after the webhook was saved.
  await assertPublicUrl(url);
  const res = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(5000) });
  await res.body?.cancel().catch(() => {});
  return { status: res.status };
};

/**
 * Send due deliveries. Claimed with SKIP LOCKED so workers never double-send.
 * 2xx = delivered. Anything else retries with backoff, then gives up; an endpoint that
 * keeps failing is switched off (and says so in Settings).
 */
export async function deliverWebhooks(db: Db, now: Date, send: Fetcher = defaultFetch) {
  const due = db
    .select({ id: webhookDelivery.id })
    .from(webhookDelivery)
    .where(and(eq(webhookDelivery.status, "pending"), lte(webhookDelivery.nextAttemptAt, now)))
    .orderBy(asc(webhookDelivery.nextAttemptAt))
    .limit(50)
    .for("update", { skipLocked: true });
  const claimed = await db.update(webhookDelivery).set({ status: "sending" }).where(inArray(webhookDelivery.id, due)).returning();
  let sent = 0;
  let failed = 0;

  for (const d of claimed) {
    const [w] = await db.select().from(webhook).where(eq(webhook.id, d.webhookId));
    if (!w || !w.active) {
      await db.update(webhookDelivery).set({ status: "failed", error: "Webhook is switched off." }).where(eq(webhookDelivery.id, d.id));
      continue;
    }
    let status: number | null = null;
    let error: string | null = null;
    try {
      ({ status } = await send(w.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Margin-Webhooks/1",
          "x-margin-event": d.event,
          "x-margin-delivery": d.id,
          "x-margin-signature": sign(w.secret, d.payload, Math.floor(now.getTime() / 1000)),
        },
        body: d.payload,
      }));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const ok = status !== null && status >= 200 && status < 300;
    const attempts = d.attempts + 1;
    if (ok) {
      sent++;
      await db.update(webhookDelivery).set({ status: "sent", attempts, responseStatus: status, error: null, deliveredAt: now }).where(eq(webhookDelivery.id, d.id));
      await db.update(webhook).set({ failureCount: 0, lastStatus: status, lastDeliveryAt: now }).where(eq(webhook.id, w.id));
    } else {
      const giveUp = attempts >= MAX_ATTEMPTS;
      if (giveUp) failed++;
      await db
        .update(webhookDelivery)
        .set({
          status: giveUp ? "failed" : "pending",
          attempts,
          responseStatus: status,
          error: error ?? `HTTP ${status}`,
          nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
        })
        .where(eq(webhookDelivery.id, d.id));
      const failures = w.failureCount + 1;
      await db
        .update(webhook)
        .set({ failureCount: failures, lastStatus: status, lastDeliveryAt: now, ...(failures >= DISABLE_AFTER ? { active: false } : {}) })
        .where(eq(webhook.id, w.id));
    }
  }

  // Unstick anything a crashed worker left mid-send.
  await db
    .update(webhookDelivery)
    .set({ status: "pending" })
    .where(and(eq(webhookDelivery.status, "sending"), lt(webhookDelivery.nextAttemptAt, new Date(now.getTime() - 5 * 60_000))));
  return { sent, failed };
}

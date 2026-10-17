import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./db/types";
import { webhook, webhookDelivery } from "./db/schema";

/*
 * One place where "something changed" is announced:
 *  - real-time: in-process pub/sub, streamed to each affected user's open tabs (SSE)
 *  - webhooks: a delivery row per matching endpoint, sent by the scheduler
 *
 * The in-process bus serves a single server. Running several app servers against one
 * Postgres would need LISTEN/NOTIFY here instead — the interface stays the same.
 */

export type ChangeType = "task" | "project" | "members" | "comment" | "notification";

export interface ChangeEvent {
  type: ChangeType;
  id?: string;
  taskId?: string;
  projectId?: string | null;
  /** The tab that made the change, so it can ignore its own echo. */
  origin?: string | null;
}

export const WEBHOOK_EVENTS = ["task.created", "task.updated", "task.completed", "task.deleted", "comment.created"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Request-scoped context set by the route wrapper (which tab sent this request). */
export const requestContext = new AsyncLocalStorage<{ clientId: string | null; userId?: string }>();

type Listener = (e: ChangeEvent) => void;
const g = globalThis as unknown as { __marginBus?: Map<string, Set<Listener>> };
const bus = (g.__marginBus ??= new Map());

export function subscribe(userId: string, fn: Listener) {
  let set = bus.get(userId);
  if (!set) bus.set(userId, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (!set!.size) bus.delete(userId);
  };
}

export function publish(userIds: string[], e: Omit<ChangeEvent, "origin">) {
  const event: ChangeEvent = { ...e, origin: requestContext.getStore()?.clientId ?? null };
  for (const id of new Set(userIds)) for (const fn of bus.get(id) ?? []) fn(event);
}

/** Queue a webhook delivery for every active endpoint, owned by one of `userIds`, that wants `event`. */
export async function enqueueWebhooks(db: Db, userIds: string[], event: WebhookEvent, data: unknown) {
  if (!userIds.length) return;
  const hooks = await db
    .select({ id: webhook.id, events: webhook.events })
    .from(webhook)
    .where(and(inArray(webhook.userId, [...new Set(userIds)]), eq(webhook.active, true)));
  const wanted = hooks.filter((h) => h.events === "*" || h.events.split(",").includes(event));
  if (!wanted.length) return;
  const createdAt = new Date().toISOString();
  await db.insert(webhookDelivery).values(
    wanted.map((h) => {
      const id = crypto.randomUUID();
      return { id, webhookId: h.id, event, payload: JSON.stringify({ id, event, createdAt, data }) };
    }),
  );
}

/** Announce a change everywhere it matters. Webhook queueing never fails the caller. */
export async function emit(db: Db, userIds: string[], change: Omit<ChangeEvent, "origin">, hook?: { event: WebhookEvent; data: unknown }) {
  publish(userIds, change);
  if (hook) await enqueueWebhooks(db, userIds, hook.event, hook.data).catch((e) => console.error("[webhooks] enqueue", e));
}

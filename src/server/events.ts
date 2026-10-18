import { AsyncLocalStorage } from "node:async_hooks";
import { and, asc, desc, eq, gt, inArray, lt } from "drizzle-orm";
import type { Db } from "./db/types";
import { changeEvent, webhook, webhookDelivery } from "./db/schema";

/*
 * One place where "something changed" is announced:
 *  - real-time: in-process pub/sub, streamed to each affected user's open tabs (SSE);
 *    or, where requests land on many short-lived instances (REALTIME=poll, the default on
 *    Netlify), a change_event row per user that tabs poll for
 *  - webhooks: a delivery row per matching endpoint, sent by the scheduler
 */

/** How open tabs hear about changes; fixed at build time (next.config.ts). */
export const POLLING = process.env.NEXT_PUBLIC_REALTIME === "poll";
/** Polled notices are kept this long; a tab away for longer refreshes everything instead. */
export const CHANGE_RETENTION_MS = 15 * 60_000;

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

export async function publish(db: Db, userIds: string[], e: Omit<ChangeEvent, "origin">) {
  const event: ChangeEvent = { ...e, origin: requestContext.getStore()?.clientId ?? null };
  const ids = [...new Set(userIds)];
  for (const id of ids) for (const fn of bus.get(id) ?? []) fn(event);
  if (!POLLING || !ids.length) return;
  // A lost notice only delays a refresh, so it never fails the change itself.
  await db
    .insert(changeEvent)
    .values(ids.map((userId) => ({ userId, type: event.type, entityId: event.id, taskId: event.taskId, projectId: event.projectId, origin: event.origin })))
    .catch((err) => console.error("[events] record", err));
}

/** The newest notice id for a user (0 if none): where a tab starts polling from. */
export async function latestChange(db: Db, userId: string) {
  const [row] = await db.select({ id: changeEvent.id }).from(changeEvent).where(eq(changeEvent.userId, userId)).orderBy(desc(changeEvent.id)).limit(1);
  return row?.id ?? 0;
}

/** Notices for a user after `since`, oldest first, in ChangeEvent shape. */
export async function changesSince(db: Db, userId: string, since: number, limit = 200) {
  const rows = await db
    .select()
    .from(changeEvent)
    .where(and(eq(changeEvent.userId, userId), gt(changeEvent.id, since)))
    .orderBy(asc(changeEvent.id))
    .limit(limit);
  return rows.map((r) => ({
    cursor: r.id,
    event: {
      type: r.type as ChangeType,
      id: r.entityId ?? undefined,
      taskId: r.taskId ?? undefined,
      projectId: r.projectId,
      origin: r.origin,
    } satisfies ChangeEvent,
  }));
}

export async function pruneChanges(db: Db, now = new Date()) {
  if (!POLLING) return;
  await db.delete(changeEvent).where(lt(changeEvent.createdAt, new Date(now.getTime() - CHANGE_RETENTION_MS)));
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
  await publish(db, userIds, change);
  if (hook) await enqueueWebhooks(db, userIds, hook.event, hook.data).catch((e) => console.error("[webhooks] enqueue", e));
}

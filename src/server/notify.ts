import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { snoozeUntil, type SnoozeChoice } from "@/lib/time/reminders";
import { aiConfigured } from "./ai";
import type { Notification, ReminderInfo, Settings } from "@/lib/types";
import { db } from "./db";
import { notification, pushSubscription, reminder, task, userSettings } from "./db/schema";
import { addReminder, getSettings, recomputeAllForUser, snoozeReminder } from "./reminders";
import { ClientError } from "./errors";
import { requireTaskRole } from "./access";

/* ------------------------------ Reminders ------------------------------ */

export async function listReminders(userId: string, taskId: string): Promise<ReminderInfo[]> {
  const rows = await db
    .select()
    .from(reminder)
    .where(and(eq(reminder.taskId, taskId), eq(reminder.userId, userId), ne(reminder.status, "dismissed")))
    .orderBy(asc(reminder.fireAt));
  return rows.map((r) => ({
    id: r.id,
    offsetMinutes: r.offsetMinutes,
    at: r.at?.toISOString() ?? null,
    fireAt: r.fireAt?.toISOString() ?? null,
    status: r.status as ReminderInfo["status"],
  }));
}

export async function createReminder(userId: string, taskId: string, spec: { offsetMinutes: number } | { at: string }) {
  // Anyone who can see a task can set their own reminders on it.
  await requireTaskRole(db, userId, taskId, "viewer");
  const [t] = await db.select({ id: task.id, dueDate: task.dueDate, dueTime: task.dueTime }).from(task).where(eq(task.id, taskId));
  if ("offsetMinutes" in spec && !t.dueDate) throw new ClientError("Give the task a date first, then a reminder before it.", 422);
  const [{ n }] = await db.select({ n: count() }).from(reminder).where(eq(reminder.taskId, taskId));
  if (n >= 10) throw new ClientError("A task can have up to 10 reminders.", 422);
  return addReminder(db, userId, t, "at" in spec ? { at: new Date(spec.at) } : spec);
}

export async function snooze(userId: string, reminderId: string, choice: SnoozeChoice) {
  const s = await getSettings(db, userId);
  const until = snoozeUntil(new Date(), choice, s.timeZone);
  const row = await snoozeReminder(db, userId, reminderId, until);
  if (!row) throw new ClientError("That reminder doesn’t exist any more.", 404);
  return { fireAt: until.toISOString() };
}

/* ------------------------------ Notifications ------------------------------ */

export async function listNotifications(userId: string): Promise<{ items: Notification[]; unread: number }> {
  const rows = await db
    .select({ n: notification, taskDone: task.completedAt })
    .from(notification)
    .leftJoin(task, eq(task.id, notification.taskId))
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(50);
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return {
    unread,
    items: rows.map(({ n, taskDone }) => ({
      id: n.id,
      kind: n.kind as Notification["kind"],
      title: n.title,
      body: n.body,
      taskId: n.taskId,
      reminderId: n.reminderId,
      createdAt: n.createdAt.toISOString(),
      read: !!n.readAt,
      taskDone: !!taskDone,
    })),
  };
}

export async function markRead(userId: string, ids: string[] | "all") {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.userId, userId),
        isNull(notification.readAt),
        ids === "all" ? undefined : inArray(notification.id, ids.length ? ids : ["-"]),
      ),
    );
}

/* ------------------------------ Settings ------------------------------ */

export function toSettings(s: Awaited<ReturnType<typeof getSettings>>): Settings {
  return {
    timeZone: s.timeZone,
    dayTime: s.dayTime,
    defaultReminderMinutes: s.defaultReminderMinutes,
    quietEnabled: s.quietEnabled,
    quietStart: s.quietStart,
    quietEnd: s.quietEnd,
    pushEnabled: s.pushEnabled,
    emailEnabled: s.emailEnabled,
    digestEnabled: s.digestEnabled,
    digestTime: s.digestTime,
    locale: s.locale,
    aiEnabled: s.aiEnabled,
  };
}

export async function readSettings(userId: string) {
  const s = await getSettings(db, userId);
  const [{ devices }] = await db.select({ devices: count() }).from(pushSubscription).where(eq(pushSubscription.userId, userId));
  // aiAvailable: whether this server has a model configured at all (independent of the user's consent).
  return { ...toSettings(s), pushDevices: devices, aiAvailable: aiConfigured() };
}

export async function updateSettings(userId: string, patch: Partial<Settings>) {
  const before = await getSettings(db, userId);
  const [after] = await db.update(userSettings).set(patch).where(eq(userSettings.userId, userId)).returning();
  // Wall-clock rules changed: every relative reminder moves.
  if ((patch.timeZone && patch.timeZone !== before.timeZone) || (patch.dayTime && patch.dayTime !== before.dayTime))
    await recomputeAllForUser(db, userId);
  return toSettings(after);
}

/* ------------------------------ Push subscriptions ------------------------------ */

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null,
) {
  await db
    .insert(pushSubscription)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await db.delete(pushSubscription).where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
}

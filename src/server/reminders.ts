import { and, eq, inArray, ne } from "drizzle-orm";
import { reminderInstant, type ReminderSpec } from "@/lib/time/reminders";
import type { Db } from "./db/types";
import { reminder, task, userSettings, type SettingsRow } from "./db/schema";

/*
 * Reminder bookkeeping shared by the API and the scheduler. Takes `db` explicitly
 * so tests can run it against an in-memory Postgres.
 */

export async function getSettings(db: Db, userId: string): Promise<SettingsRow> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (row) return row;
  const [created] = await db.insert(userSettings).values({ userId }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(userSettings).where(eq(userSettings.userId, userId)))[0];
}

type TaskTiming = { id: string; dueDate: string | null; dueTime: string | null };

function fireAtFor(r: { offsetMinutes: number | null; at: Date | null }, t: TaskTiming, s: SettingsRow) {
  const spec: ReminderSpec = r.at ? { at: r.at } : { offsetMinutes: r.offsetMinutes ?? 0 };
  return reminderInstant(spec, t, s.timeZone, s.dayTime);
}

export async function addReminder(
  db: Db,
  userId: string,
  t: TaskTiming,
  spec: ReminderSpec,
  now = new Date(),
) {
  const s = await getSettings(db, userId);
  const row = "at" in spec ? { offsetMinutes: null, at: spec.at } : { offsetMinutes: spec.offsetMinutes, at: null };
  const fireAt = fireAtFor(row, t, s);
  const [created] = await db
    .insert(reminder)
    .values({
      userId,
      taskId: t.id,
      ...row,
      fireAt,
      // A reminder whose moment has already passed is recorded but never fires.
      status: fireAt && fireAt.getTime() <= now.getTime() - 60_000 ? "skipped" : "pending",
    })
    .returning();
  return created;
}

/**
 * Called whenever a task's date/time changes (edit, reschedule, recurrence advancing)
 * or the user's timezone changes. Relative reminders move with the task; any that
 * now lie in the future are re-armed, even if they had already fired for the old date.
 */
export async function recomputeTaskReminders(db: Db, _actorId: string, taskId: string, now = new Date()) {
  // Every member's reminders on this task move, each in its owner's own time zone.
  const [t] = await db.select({ id: task.id, dueDate: task.dueDate, dueTime: task.dueTime }).from(task).where(eq(task.id, taskId));
  if (!t) return;
  const settingsFor = new Map<string, SettingsRow>();
  const rows = await db
    .select()
    .from(reminder)
    .where(and(eq(reminder.taskId, taskId), ne(reminder.status, "dismissed")));
  for (const r of rows) {
    if (r.at) continue; // absolute reminders don't follow the task
    if (!settingsFor.has(r.userId)) settingsFor.set(r.userId, await getSettings(db, r.userId));
    const fireAt = fireAtFor(r, { ...t, dueTime: t.dueTime?.slice(0, 5) ?? null }, settingsFor.get(r.userId)!);
    const future = !!fireAt && fireAt.getTime() > now.getTime();
    await db
      .update(reminder)
      .set({ fireAt, status: future ? "pending" : r.status === "pending" ? "skipped" : r.status, attempts: future ? 0 : r.attempts })
      .where(eq(reminder.id, r.id));
  }
}

/** After a timezone or day-time change, every open task's relative reminders shift. */
export async function recomputeAllForUser(db: Db, userId: string, now = new Date()) {
  const rows = await db
    .selectDistinct({ taskId: reminder.taskId })
    .from(reminder)
    .where(and(eq(reminder.userId, userId), inArray(reminder.status, ["pending", "skipped", "sent"])));
  for (const r of rows) await recomputeTaskReminders(db, userId, r.taskId, now);
}

/** Snooze: fire again at `until`, whatever state it was in. */
export async function snoozeReminder(db: Db, userId: string, reminderId: string, until: Date) {
  const [row] = await db
    .update(reminder)
    .set({ status: "pending", fireAt: until, attempts: 0 })
    .where(and(eq(reminder.id, reminderId), eq(reminder.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteReminder(db: Db, userId: string, reminderId: string) {
  const rows = await db
    .delete(reminder)
    .where(and(eq(reminder.id, reminderId), eq(reminder.userId, userId)))
    .returning({ id: reminder.id });
  return rows.length > 0;
}

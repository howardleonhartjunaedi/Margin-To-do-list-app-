import { addDays } from "../dates";
import { instantToZoned, minutesOf, zonedToInstant } from "./zone";

/** A task's reminders are offsets from its due moment, or fixed instants. */
export type ReminderSpec = { offsetMinutes: number } | { at: Date };

/** Time used for "due" when a task has a date but no time. */
export const DEFAULT_DAY_TIME = "09:00";

/** The instant a reminder should fire, or null if it can't (relative reminder, no due date). */
export function reminderInstant(
  spec: ReminderSpec,
  task: { dueDate: string | null; dueTime: string | null },
  tz: string,
  dayTime = DEFAULT_DAY_TIME,
): Date | null {
  if ("at" in spec) return spec.at;
  if (!task.dueDate) return null;
  const due = zonedToInstant(task.dueDate, task.dueTime ?? dayTime, tz);
  return new Date(due.getTime() - spec.offsetMinutes * 60_000);
}

export interface QuietHours {
  start: string; // "22:00"
  end: string; // "07:00"
}

/** Is `instant` inside quiet hours (local to `tz`)? Handles windows that cross midnight. */
export function inQuietHours(instant: Date, q: QuietHours | null, tz: string) {
  if (!q || q.start === q.end) return false;
  const now = minutesOf(instantToZoned(instant, tz).time);
  const s = minutesOf(q.start);
  const e = minutesOf(q.end);
  return s < e ? now >= s && now < e : now >= s || now < e;
}

/** The first instant at or after `instant` that is outside quiet hours. */
export function afterQuietHours(instant: Date, q: QuietHours | null, tz: string): Date {
  if (!inQuietHours(instant, q, tz)) return instant;
  const local = instantToZoned(instant, tz);
  // End is today if we're before it (early morning), otherwise tomorrow.
  const endDate = minutesOf(local.time) < minutesOf(q!.end) ? local.date : addDays(local.date, 1);
  return zonedToInstant(endDate, q!.end, tz);
}

export type SnoozeChoice = { minutes: number } | { tomorrowAt: string };

/** When a snoozed reminder should fire again. */
export function snoozeUntil(now: Date, choice: SnoozeChoice, tz: string): Date {
  if ("minutes" in choice) return new Date(now.getTime() + choice.minutes * 60_000);
  const today = instantToZoned(now, tz).date;
  return zonedToInstant(addDays(today, 1), choice.tomorrowAt, tz);
}

/** Has the user's local clock reached their digest time today, and have we not sent today's yet? */
export function digestDue(now: Date, tz: string, digestTime: string, lastSentOn: string | null) {
  const local = instantToZoned(now, tz);
  return minutesOf(local.time) >= minutesOf(digestTime) && lastSentOn !== local.date ? local.date : null;
}

/** "30 minutes before", "At time of task", "1 day before" … */
export function describeOffset(min: number) {
  if (min === 0) return "At time of task";
  const abs = Math.abs(min);
  const unit = abs % 1440 === 0 ? ["day", abs / 1440] : abs % 60 === 0 ? ["hour", abs / 60] : ["minute", abs];
  const n = unit[1] as number;
  return `${n} ${unit[0]}${n === 1 ? "" : "s"} ${min > 0 ? "before" : "after"}`;
}

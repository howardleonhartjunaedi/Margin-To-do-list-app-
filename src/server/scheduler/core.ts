import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { formatDue, formatTime } from "@/lib/dates";
import { afterQuietHours, digestDue, inQuietHours, type QuietHours } from "@/lib/time/reminders";
import { instantToZoned } from "@/lib/time/zone";
import type { Db } from "../db/types";
import { notification, reminder, task, user, userSettings } from "../db/schema";
import { getSettings } from "../reminders";
import { forMe, taskAccess, visibleTask } from "../access";

/*
 * One scheduler tick. Pure with respect to time and delivery: `now` and the outbound
 * channels are injected, so tests drive it with a fake clock and fake push/email.
 *
 * Guarantees
 *  - Each reminder is claimed by exactly one worker (FOR UPDATE SKIP LOCKED), so running
 *    several workers, or overlapping ticks, never double-sends.
 *  - The in-app notification and the "sent" mark commit together. Push and email go out
 *    after the commit: at most once, never blocking the in-app record.
 *  - Quiet hours defer the whole reminder to the end of the window.
 *  - Reminders more than LATE_AFTER behind (server was down) land in-app only, silently,
 *    instead of buzzing a phone about something long gone.
 */

export interface OutboundMessage {
  userId: string;
  email: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  reminderId?: string;
  taskId?: string;
  /** Email footer; defaults to the reminders explanation. */
  footer?: string;
}

export interface Channels {
  push(msg: OutboundMessage): Promise<void>;
  email(msg: OutboundMessage): Promise<void>;
  /** Tell the user's open tabs a notification arrived (optional; real-time). */
  inApp?(userId: string): void;
}

export interface TickReport {
  sent: number;
  deferred: number;
  skipped: number;
  late: number;
  failed: number;
  digests: number;
}

export const BATCH = 100;
export const LATE_AFTER_MS = 60 * 60_000;
const STUCK_AFTER_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

export async function runTick(db: Db, now: Date, channels: Channels, baseUrl = ""): Promise<TickReport> {
  const report: TickReport = { sent: 0, deferred: 0, skipped: 0, late: 0, failed: 0, digests: 0 };

  // A worker that died mid-delivery leaves rows in "sending"; give them back.
  await db
    .update(reminder)
    .set({ status: "pending" })
    .where(and(eq(reminder.status, "sending"), lt(reminder.updatedAt, new Date(now.getTime() - STUCK_AFTER_MS))));

  const due = db
    .select({ id: reminder.id })
    .from(reminder)
    .where(and(eq(reminder.status, "pending"), lte(reminder.fireAt, now)))
    .orderBy(asc(reminder.fireAt))
    .limit(BATCH)
    .for("update", { skipLocked: true });
  const claimed = await db
    .update(reminder)
    .set({ status: "sending", updatedAt: now })
    .where(inArray(reminder.id, due))
    .returning();

  for (const r of claimed) {
    try {
      await handleReminder(db, r, now, channels, baseUrl, report);
    } catch (err) {
      const attempts = r.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await db
        .update(reminder)
        .set({
          status: failed ? "failed" : "pending",
          attempts,
          fireAt: failed ? r.fireAt : new Date(now.getTime() + 2 ** attempts * 30_000), // 1, 2, 4, 8 min
        })
        .where(eq(reminder.id, r.id));
      if (failed) report.failed++;
      console.error("[scheduler] reminder", r.id, err);
    }
  }

  report.digests = await runDigests(db, now, channels, baseUrl);
  return report;
}

async function handleReminder(
  db: Db,
  r: typeof reminder.$inferSelect,
  now: Date,
  channels: Channels,
  baseUrl: string,
  report: TickReport,
) {
  const [t] = await db.select().from(task).where(eq(task.id, r.taskId));
  const [owner] = await db.select({ email: user.email }).from(user).where(eq(user.id, r.userId));
  // Also skip if the reminder's owner has since lost access (left or was removed from the project).
  const canSee = t && (await taskAccess(db, r.userId, t.id)) !== null;
  if (!t || !owner || !canSee || t.deletedAt || t.completedAt) {
    await db.update(reminder).set({ status: "skipped" }).where(eq(reminder.id, r.id));
    report.skipped++;
    return;
  }

  const s = await getSettings(db, r.userId);
  const quiet: QuietHours | null = s.quietEnabled ? { start: s.quietStart, end: s.quietEnd } : null;
  if (inQuietHours(now, quiet, s.timeZone)) {
    await db
      .update(reminder)
      .set({ status: "pending", fireAt: afterQuietHours(now, quiet, s.timeZone) })
      .where(eq(reminder.id, r.id));
    report.deferred++;
    return;
  }

  const late = !!r.fireAt && now.getTime() - r.fireAt.getTime() > LATE_AFTER_MS;
  const today = instantToZoned(now, s.timeZone).date;
  const time = t.dueTime ? formatTime(t.dueTime) : null;
  const body = !t.dueDate
    ? "Reminder"
    : t.dueDate < today
      ? `Overdue — was due ${formatDue(t.dueDate, today, time)}`
      : `Due ${formatDue(t.dueDate, today, time)}`;

  await db.transaction(async (tx) => {
    await tx.insert(notification).values({
      userId: r.userId,
      taskId: t.id,
      reminderId: r.id,
      kind: "reminder",
      title: t.title,
      body,
      createdAt: now,
    });
    await tx
      .update(reminder)
      .set({ status: "sent", sentAt: now, attempts: r.attempts + 1 })
      .where(eq(reminder.id, r.id));
  });
  report.sent++;
  channels.inApp?.(r.userId);

  if (late) {
    report.late++;
    return;
  }
  const msg: OutboundMessage = {
    userId: r.userId,
    email: owner.email,
    title: t.title,
    body,
    url: `${baseUrl}/today?task=${t.id}`,
    tag: `reminder-${r.id}`,
    reminderId: r.id,
    taskId: t.id,
  };
  // External channels are best-effort; the in-app record above is the source of truth.
  await Promise.allSettled([
    s.pushEnabled ? channels.push(msg) : Promise.resolve(),
    s.emailEnabled ? channels.email(msg) : Promise.resolve(),
  ]).then((rs) => rs.forEach((x) => x.status === "rejected" && console.error("[scheduler] channel", x.reason)));
}

async function runDigests(db: Db, now: Date, channels: Channels, baseUrl: string) {
  let sent = 0;
  const candidates = await db
    .select({ s: userSettings, email: user.email })
    .from(userSettings)
    .innerJoin(user, eq(user.id, userSettings.userId))
    .where(eq(userSettings.digestEnabled, true));

  for (const { s, email } of candidates) {
    const localDate = digestDue(now, s.timeZone, s.digestTime, s.lastDigestOn);
    if (!localDate) continue;
    // Claim today's digest for this user; another worker may have beaten us.
    const claimed = await db
      .update(userSettings)
      .set({ lastDigestOn: localDate })
      .where(
        and(
          eq(userSettings.userId, s.userId),
          or(isNull(userSettings.lastDigestOn), sql`${userSettings.lastDigestOn} <> ${localDate}`),
        ),
      )
      .returning({ userId: userSettings.userId });
    if (!claimed.length) continue;

    const open = and(visibleTask(s.userId), forMe(s.userId), isNull(task.completedAt), isNull(task.deletedAt), isNull(task.parentId));
    const rows = await db
      .select({ title: task.title, dueDate: task.dueDate, dueTime: task.dueTime, priority: task.priority })
      .from(task)
      .where(and(open, lte(task.dueDate, localDate)))
      .orderBy(asc(task.dueDate), asc(task.priority))
      .limit(50);
    if (!rows.length) continue; // nothing due: stay quiet

    const overdue = rows.filter((r) => r.dueDate! < localDate).length;
    const todayCount = rows.length - overdue;
    const title = `Today: ${todayCount} ${todayCount === 1 ? "task" : "tasks"}${overdue ? `, ${overdue} overdue` : ""}`;
    const lines = rows.slice(0, 10).map((r) => `• ${r.title}${r.dueTime ? ` — ${formatTime(r.dueTime)}` : ""}${r.dueDate! < localDate ? " (overdue)" : ""}`);
    if (rows.length > 10) lines.push(`…and ${rows.length - 10} more`);
    const body = lines.join("\n");

    await db.insert(notification).values({ userId: s.userId, kind: "digest", title, body, createdAt: now });
    channels.inApp?.(s.userId);
    sent++;
    if (s.emailEnabled) {
      await channels
        .email({ userId: s.userId, email, title, body, url: `${baseUrl}/today`, tag: `digest-${localDate}` })
        .catch((e) => console.error("[scheduler] digest email", e));
    }
  }
  return sent;
}


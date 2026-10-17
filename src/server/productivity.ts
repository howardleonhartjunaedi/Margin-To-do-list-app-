import "server-only";
import { and, asc, count, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { addDays } from "@/lib/dates";
import { instantToZoned } from "@/lib/time/zone";
import { db } from "./db";
import { completion, dailyNote, focusSession, habit, habitCheck, project, task } from "./db/schema";
import { getSettings } from "./reminders";
import { ClientError } from "./errors";
import { forMe, taskAccess, visibleTask } from "./access";

/* ------------------------------ Focus ------------------------------ */

export async function recordFocus(
  userId: string,
  input: { taskId?: string | null; kind: "focus" | "break"; plannedSeconds: number; actualSeconds: number; completed: boolean; startedAt: string; endedAt: string },
) {
  if (input.taskId) {
    if (!(await taskAccess(db, userId, input.taskId))) input = { ...input, taskId: null }; // task gone: keep the minutes, drop the link
  }
  const [row] = await db
    .insert(focusSession)
    .values({ ...input, userId, taskId: input.taskId ?? null, startedAt: new Date(input.startedAt), endedAt: new Date(input.endedAt) })
    .returning({ id: focusSession.id });
  return row;
}

/** Focus minutes for one task (shown in task detail). */
export async function focusForTask(userId: string, taskId: string) {
  const [r] = await db
    .select({ seconds: sql<number>`coalesce(sum(${focusSession.actualSeconds}), 0)::int`, sessions: count() })
    .from(focusSession)
    .where(and(eq(focusSession.userId, userId), eq(focusSession.taskId, taskId), eq(focusSession.kind, "focus")));
  return { minutes: Math.round(Number(r.seconds) / 60), sessions: Number(r.sessions) };
}

/* ------------------------------ Habits ------------------------------ */

export interface HabitWithChecks {
  id: string;
  name: string;
  color: string;
  targetPerWeek: number;
  sortKey: string;
  createdOn: string;
  checks: string[];
}

export async function listHabits(userId: string): Promise<HabitWithChecks[]> {
  const s = await getSettings(db, userId);
  const today = instantToZoned(new Date(), s.timeZone).date;
  const since = addDays(today, -400); // enough for a year heatmap and streaks
  const rows = await db
    .select()
    .from(habit)
    .where(and(eq(habit.userId, userId), isNull(habit.archivedAt)))
    .orderBy(asc(habit.sortKey));
  if (!rows.length) return [];
  const checks = await db
    .select({ habitId: habitCheck.habitId, date: habitCheck.date })
    .from(habitCheck)
    .innerJoin(habit, eq(habit.id, habitCheck.habitId))
    .where(and(eq(habit.userId, userId), gte(habitCheck.date, since)));
  const by = new Map<string, string[]>();
  for (const c of checks) by.set(c.habitId, [...(by.get(c.habitId) ?? []), c.date]);
  return rows.map((h) => ({
    id: h.id,
    name: h.name,
    color: h.color,
    targetPerWeek: h.targetPerWeek,
    sortKey: h.sortKey,
    createdOn: instantToZoned(h.createdAt, s.timeZone).date,
    checks: (by.get(h.id) ?? []).sort(),
  }));
}

export async function createHabit(userId: string, input: { id?: string; name: string; color?: string; targetPerWeek?: number }) {
  const [last] = await db.select({ k: habit.sortKey }).from(habit).where(eq(habit.userId, userId)).orderBy(desc(habit.sortKey)).limit(1);
  const [row] = await db
    .insert(habit)
    .values({
      ...(input.id ? { id: input.id } : {}),
      userId,
      name: input.name,
      color: input.color ?? "ink",
      targetPerWeek: input.targetPerWeek ?? 7,
      sortKey: generateKeyBetween(last?.k ?? null, null),
    })
    .returning();
  return row;
}

async function ownHabit(userId: string, id: string) {
  const [h] = await db.select({ id: habit.id }).from(habit).where(and(eq(habit.id, id), eq(habit.userId, userId)));
  if (!h) throw new ClientError("That habit doesn’t exist any more.", 404);
}

export async function updateHabit(
  userId: string,
  id: string,
  patch: { name?: string; color?: string; targetPerWeek?: number; sortKey?: string; archived?: boolean },
) {
  await ownHabit(userId, id);
  const { archived, ...rest } = patch;
  await db
    .update(habit)
    .set({ ...rest, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}) })
    .where(eq(habit.id, id));
}

export async function deleteHabit(userId: string, id: string) {
  await ownHabit(userId, id);
  await db.delete(habit).where(eq(habit.id, id));
}

/** Idempotent: setting a check that exists, or clearing one that doesn't, is a no-op. */
export async function setHabitCheck(userId: string, id: string, date: string, done: boolean) {
  await ownHabit(userId, id);
  if (done) await db.insert(habitCheck).values({ habitId: id, date }).onConflictDoNothing();
  else await db.delete(habitCheck).where(and(eq(habitCheck.habitId, id), eq(habitCheck.date, date)));
}

/* ------------------------------ Daily notes ------------------------------ */

export async function getDay(userId: string, date: string) {
  const [row] = await db.select().from(dailyNote).where(and(eq(dailyNote.userId, userId), eq(dailyNote.date, date)));
  return {
    date,
    intention: row?.intention ?? "",
    reflection: row?.reflection ?? "",
    capacityMinutes: row?.capacityMinutes ?? null,
    plannedAt: row?.plannedAt?.toISOString() ?? null,
    reviewedAt: row?.reviewedAt?.toISOString() ?? null,
  };
}

export async function saveDay(
  userId: string,
  date: string,
  patch: { intention?: string; reflection?: string; capacityMinutes?: number | null; planned?: boolean; reviewed?: boolean },
) {
  const { planned, reviewed, ...rest } = patch;
  const values = {
    ...rest,
    ...(planned !== undefined ? { plannedAt: planned ? new Date() : null } : {}),
    ...(reviewed !== undefined ? { reviewedAt: reviewed ? new Date() : null } : {}),
  };
  await db
    .insert(dailyNote)
    .values({ userId, date, ...values })
    .onConflictDoUpdate({ target: [dailyNote.userId, dailyNote.date], set: values });
  return getDay(userId, date);
}

/* ------------------------------ Stats ------------------------------ */

export async function getStats(userId: string, from: string, to: string) {
  const s = await getSettings(db, userId);
  const tz = s.timeZone;
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const prevFrom = addDays(from, -span);
  const prevTo = addDays(from, -1);

  const localDay = sql<string>`to_char(${completion.completedAt} at time zone ${tz}, 'YYYY-MM-DD')`;
  const inRange = (a: string, b: string) =>
    and(eq(completion.userId, userId), sql`(${completion.completedAt} at time zone ${tz})::date between ${a}::date and ${b}::date`);

  const [byDay, byHour, byProject, onTime, prev, activeDays, focusByDay, prevFocus, created] = await Promise.all([
    // Group by position: the time zone is a bound parameter, so the expression can't be repeated verbatim.
    db.select({ day: localDay, n: count() }).from(completion).where(inRange(from, to)).groupBy(sql`1`),
    db
      .select({ hour: sql<number>`extract(hour from ${completion.completedAt} at time zone ${tz})::int`, n: count() })
      .from(completion)
      .where(inRange(from, to))
      .groupBy(sql`1`),
    db
      .select({ projectId: task.projectId, name: project.name, color: project.color, n: count() })
      .from(completion)
      .innerJoin(task, eq(task.id, completion.taskId))
      .leftJoin(project, eq(project.id, task.projectId))
      .where(inRange(from, to))
      .groupBy(task.projectId, project.name, project.color)
      .orderBy(desc(count())),
    db
      .select({
        onTime: sql<number>`count(*) filter (where ${completion.dueDate} is not null and ${localDay} <= ${completion.dueDate}::text)::int`,
        late: sql<number>`count(*) filter (where ${completion.dueDate} is not null and ${localDay} > ${completion.dueDate}::text)::int`,
        undated: sql<number>`count(*) filter (where ${completion.dueDate} is null)::int`,
      })
      .from(completion)
      .where(inRange(from, to)),
    db.select({ n: count() }).from(completion).where(inRange(prevFrom, prevTo)),
    db
      .selectDistinct({ day: localDay })
      .from(completion)
      .where(inRange(addDays(to, -400), to)),
    (() => {
      const fday = sql<string>`to_char(${focusSession.startedAt} at time zone ${tz}, 'YYYY-MM-DD')`;
      return db
        .select({ day: fday, seconds: sql<number>`sum(${focusSession.actualSeconds})::int` })
        .from(focusSession)
        .where(
          and(
            eq(focusSession.userId, userId),
            eq(focusSession.kind, "focus"),
            sql`(${focusSession.startedAt} at time zone ${tz})::date between ${from}::date and ${to}::date`,
          ),
        )
        .groupBy(sql`1`);
    })(),
    db
      .select({ seconds: sql<number>`coalesce(sum(${focusSession.actualSeconds}), 0)::int` })
      .from(focusSession)
      .where(
        and(
          eq(focusSession.userId, userId),
          eq(focusSession.kind, "focus"),
          sql`(${focusSession.startedAt} at time zone ${tz})::date between ${prevFrom}::date and ${prevTo}::date`,
        ),
      ),
    db
      .select({ n: count() })
      .from(task)
      .where(
        and(
          eq(task.userId, userId),
          isNull(task.parentId),
          sql`(${task.createdAt} at time zone ${tz})::date between ${from}::date and ${to}::date`,
        ),
      ),
  ]);

  const hours = Array.from({ length: 24 }, () => 0);
  for (const h of byHour) hours[Number(h.hour)] = Number(h.n);

  return {
    from,
    to,
    today: instantToZoned(new Date(), tz).date,
    completedByDay: Object.fromEntries(byDay.map((r) => [r.day, Number(r.n)])),
    focusMinutesByDay: Object.fromEntries(focusByDay.map((r) => [r.day, Math.round(Number(r.seconds) / 60)])),
    byHour: hours,
    byProject: byProject.map((r) => ({ projectId: r.projectId, name: r.name ?? "Inbox", color: r.color ?? "ink", n: Number(r.n) })),
    onTime: { onTime: Number(onTime[0].onTime), late: Number(onTime[0].late), undated: Number(onTime[0].undated) },
    previous: { completed: Number(prev[0].n), focusMinutes: Math.round(Number(prevFocus[0].seconds) / 60) },
    created: Number(created[0].n),
    activeDays: activeDays.map((r) => r.day),
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;

/** What got done on a local day (for the evening review). */
export async function completedOn(userId: string, date: string) {
  const s = await getSettings(db, userId);
  const rows = await db
    .select({ id: task.id, title: task.title, completedAt: completion.completedAt })
    .from(completion)
    .innerJoin(task, eq(task.id, completion.taskId))
    .where(and(eq(completion.userId, userId), isNull(task.deletedAt), sql`(${completion.completedAt} at time zone ${s.timeZone})::date = ${date}::date`))
    .orderBy(asc(completion.completedAt));
  return rows.map((r) => ({ ...r, completedAt: r.completedAt.toISOString() }));
}

/** Today's planning numbers: open tasks due today and their estimates. */
export async function dayLoad(userId: string, date: string) {
  const [r] = await db
    .select({
      tasks: count(),
      estimated: sql<number>`coalesce(sum(${task.estimateMinutes}), 0)::int`,
      unestimated: sql<number>`count(*) filter (where ${task.estimateMinutes} is null)::int`,
    })
    .from(task)
    .where(
      and(
        visibleTask(userId),
        forMe(userId),
        isNull(task.completedAt),
        isNull(task.deletedAt),
        isNull(task.parentId),
        isNotNull(task.dueDate),
        lte(task.dueDate, date),
      ),
    );
  return { tasks: Number(r.tasks), estimatedMinutes: Number(r.estimated), unestimated: Number(r.unestimated) };
}

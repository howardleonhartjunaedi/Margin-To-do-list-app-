import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import type { Counts, Project, SavedFilter, SearchHit, Task } from "@/lib/types";
import type { z } from "zod";
import type { CreateTaskInput, UpdateTaskInput, viewQuerySchema } from "@/lib/validation";
import { db } from "./db";
import { advanceRecurring } from "@/lib/time/recurrence";
import { instantToZoned } from "@/lib/time/zone";
import { completion, label, project, savedFilter, task, taskLabel } from "./db/schema";
import { addReminder, getSettings, recomputeTaskReminders } from "./reminders";

/** Thrown for anything the client did wrong; route handlers turn it into a 4xx. */
export class ClientError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const MAX_LIST = 5000;

// Correlated subqueries must name the outer row explicitly: drizzle renders ${task.id}
// as a bare "id" in a select list, which would bind to the inner table instead.
const OUTER_TASK_ID = sql.raw('"task"."id"');
const OUTER_PROJECT_ID = sql.raw('"project"."id"');

const taskColumns = {
  id: task.id,
  projectId: task.projectId,
  parentId: task.parentId,
  title: task.title,
  notes: task.notes,
  priority: task.priority,
  startDate: task.startDate,
  dueDate: task.dueDate,
  dueTime: task.dueTime,
  recurrence: task.recurrence,
  estimateMinutes: task.estimateMinutes,
  sortKey: task.sortKey,
  completedAt: task.completedAt,
  createdAt: task.createdAt,
  subtaskCount: sql<number>`(select count(*)::int from task s where s.parent_id = ${OUTER_TASK_ID} and s.deleted_at is null)`,
  subtaskDone: sql<number>`(select count(*)::int from task s where s.parent_id = ${OUTER_TASK_ID} and s.deleted_at is null and s.completed_at is not null)`,
  labels: sql<string[]>`coalesce((select array_agg(l.name order by lower(l.name)) from task_label tl join label l on l.id = tl.label_id where tl.task_id = ${OUTER_TASK_ID}), '{}')`,
};

type RawTask = { [K in keyof typeof taskColumns]: unknown };

function toTask(r: RawTask): Task {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
  return {
    id: r.id as string,
    projectId: (r.projectId as string) ?? null,
    parentId: (r.parentId as string) ?? null,
    title: r.title as string,
    notes: r.notes as string,
    priority: r.priority as Task["priority"],
    startDate: (r.startDate as string) ?? null,
    dueDate: (r.dueDate as string) ?? null,
    dueTime: r.dueTime ? String(r.dueTime).slice(0, 5) : null,
    recurrence: (r.recurrence as string) ?? null,
    estimateMinutes: (r.estimateMinutes as number) ?? null,
    sortKey: r.sortKey as string,
    completedAt: iso(r.completedAt),
    createdAt: iso(r.createdAt)!,
    labels: (r.labels as string[]) ?? [],
    subtaskCount: Number(r.subtaskCount ?? 0),
    subtaskDone: Number(r.subtaskDone ?? 0),
  };
}

const open = (userId: string) =>
  and(eq(task.userId, userId), isNull(task.deletedAt), isNull(task.completedAt), isNull(task.parentId));

// Date-sorted views: overdue first, then by day, timed before untimed, then priority.
const byDue = [asc(task.dueDate), sql`${task.dueTime} asc nulls last`, asc(task.priority), asc(task.sortKey)];

export type ViewQuery = z.infer<typeof viewQuerySchema>;

export async function listTasks(userId: string, q: ViewQuery): Promise<Task[]> {
  let where: SQL | undefined;
  let order = [asc(task.sortKey)];
  switch (q.view) {
    case "inbox":
      where = and(open(userId), isNull(task.projectId));
      break;
    case "today":
      where = and(open(userId), lte(task.dueDate, q.today));
      order = byDue;
      break;
    case "upcoming":
      // Includes overdue so nothing slips out of sight.
      where = and(open(userId), isNotNull(task.dueDate), lt(task.dueDate, q.to));
      order = byDue;
      break;
    case "project":
      where = and(open(userId), eq(task.projectId, q.id));
      break;
    case "range":
      // Due in range, or a start–due span that overlaps it.
      where = and(
        open(userId),
        q.projectId ? eq(task.projectId, q.projectId) : undefined,
        isNotNull(task.dueDate),
        gte(task.dueDate, q.from),
        lte(sql`coalesce(${task.startDate}, ${task.dueDate})`, q.to),
      );
      order = byDue;
      break;
    case "all":
      where = open(userId);
      order = [sql`${task.dueDate} asc nulls last`, asc(task.priority), asc(task.sortKey)];
      break;
  }
  const rows = await db.select(taskColumns).from(task).where(where).orderBy(...order).limit(MAX_LIST);
  return rows.map(toTask);
}

export async function getTaskWithSubtasks(userId: string, id: string) {
  const [row] = await db
    .select(taskColumns)
    .from(task)
    .where(and(eq(task.id, id), eq(task.userId, userId), isNull(task.deletedAt)));
  if (!row) throw new ClientError("That task doesn’t exist any more.", 404);
  const subtasks = await db
    .select(taskColumns)
    .from(task)
    .where(and(eq(task.parentId, id), eq(task.userId, userId), isNull(task.deletedAt)))
    .orderBy(asc(task.sortKey));
  return { task: toTask(row), subtasks: subtasks.map(toTask) };
}

async function assertProject(userId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const [p] = await db.select({ id: project.id }).from(project).where(and(eq(project.id, projectId), eq(project.userId, userId)));
  if (!p) throw new ClientError("That project doesn’t exist.", 404);
}

async function lastSortKey(userId: string, projectId: string | null, parentId: string | null) {
  const [row] = await db
    .select({ k: task.sortKey })
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        parentId ? eq(task.parentId, parentId) : and(isNull(task.parentId), projectId ? eq(task.projectId, projectId) : isNull(task.projectId)),
      ),
    )
    .orderBy(desc(task.sortKey))
    .limit(1);
  return row?.k ?? null;
}

async function setLabels(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, taskId: string, names: string[]) {
  await tx.delete(taskLabel).where(eq(taskLabel.taskId, taskId));
  const unique = [...new Map(names.toReversed().map((n) => [n.toLowerCase(), n])).values()]; // first spelling wins
  if (!unique.length) return;
  await tx.insert(label).values(unique.map((name) => ({ userId, name }))).onConflictDoNothing();
  const rows = await tx
    .select({ id: label.id })
    .from(label)
    .where(and(eq(label.userId, userId), inArray(sql`lower(${label.name})`, unique.map((n) => n.toLowerCase()))));
  await tx.insert(taskLabel).values(rows.map((r) => ({ taskId, labelId: r.id }))).onConflictDoNothing();
}

function assertSpan(start: string | null | undefined, due: string | null | undefined) {
  if (start && due && start > due) throw new ClientError("A task can’t start after it’s due.", 422);
  if (start && !due) throw new ClientError("Give the task a due date before a start date.", 422);
}

export async function createTask(userId: string, input: CreateTaskInput): Promise<Task> {
  assertSpan(input.startDate, input.dueDate);
  let projectId = input.projectId ?? null;
  const parentId = input.parentId ?? null;
  if (parentId) {
    const [parent] = await db
      .select({ projectId: task.projectId })
      .from(task)
      .where(and(eq(task.id, parentId), eq(task.userId, userId)));
    if (!parent) throw new ClientError("The parent task doesn’t exist.", 404);
    projectId = parent.projectId; // subtasks live where their parent lives
  } else {
    await assertProject(userId, projectId);
  }
  const sortKey = generateKeyBetween(await lastSortKey(userId, projectId, parentId), null);

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(task)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        projectId,
        parentId,
        title: input.title,
        notes: input.notes ?? "",
        priority: input.priority ?? 4,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        recurrence: input.recurrence ?? null,
        estimateMinutes: input.estimateMinutes ?? null,
        sortKey,
      })
      .returning({ id: task.id });
    if (input.labels?.length) await setLabels(tx, userId, row.id, input.labels);
    return row.id;
  });
  // A task with a time gets the user's default reminder, if they've set one.
  if (input.dueDate && input.dueTime && !parentId) {
    const settings = await getSettings(db, userId);
    if (settings.defaultReminderMinutes != null)
      await addReminder(db, userId, { id, dueDate: input.dueDate, dueTime: input.dueTime }, { offsetMinutes: settings.defaultReminderMinutes });
  }
  return (await getTaskWithSubtasks(userId, id)).task;
}

export async function updateTask(userId: string, id: string, input: UpdateTaskInput): Promise<Task> {
  const [existing] = await db
    .select({ id: task.id, recurrence: task.recurrence, startDate: task.startDate, dueDate: task.dueDate, completedAt: task.completedAt })
    .from(task)
    .where(and(eq(task.id, id), eq(task.userId, userId)));
  if (!existing) throw new ClientError("That task doesn’t exist any more.", 404);
  if (input.projectId !== undefined) await assertProject(userId, input.projectId);
  if (input.startDate !== undefined || input.dueDate !== undefined) {
    // Clearing the due date clears the start too; otherwise the span must be ordered.
    const due = input.dueDate !== undefined ? input.dueDate : existing.dueDate;
    const start = input.dueDate === null ? null : input.startDate !== undefined ? input.startDate : existing.startDate;
    assertSpan(start, due);
    if (input.dueDate === null) input = { ...input, startDate: null };
  }

  const { completed, deleted, labels, ...fields } = input;
  const patch: Partial<typeof task.$inferInsert> = { ...fields };
  const recurring = (fields.recurrence !== undefined ? fields.recurrence : existing.recurrence) ?? null;
  if (completed === true && recurring) {
    // A repeating task never closes: it moves to its next occurrence.
    const settings = await getSettings(db, userId);
    const today = instantToZoned(new Date(), settings.timeZone).date;
    patch.dueDate = advanceRecurring(recurring, existing.dueDate, today);
    if (existing.startDate && existing.dueDate) {
      const span = (Date.parse(existing.dueDate) - Date.parse(existing.startDate)) / 86_400_000;
      const d = new Date(Date.parse(patch.dueDate) - span * 86_400_000);
      patch.startDate = d.toISOString().slice(0, 10);
    }
    patch.completedAt = null;
  } else if (completed !== undefined) {
    patch.completedAt = completed ? new Date() : null;
  }
  if (deleted !== undefined) patch.deletedAt = deleted ? new Date() : null;
  if (fields.dueDate === null) patch.dueTime = null; // no time without a day

  await db.transaction(async (tx) => {
    // Completion history (feeds stats). Undo removes the most recent one.
    if (completed === true && (recurring || !existing.completedAt))
      await tx.insert(completion).values({ userId, taskId: id, dueDate: existing.dueDate });
    if (completed === false) {
      const [last] = await tx
        .select({ id: completion.id })
        .from(completion)
        .where(and(eq(completion.taskId, id), eq(completion.userId, userId)))
        .orderBy(desc(completion.completedAt))
        .limit(1);
      if (last) await tx.delete(completion).where(eq(completion.id, last.id));
    }
    if (Object.keys(patch).length) {
      await tx.update(task).set(patch).where(and(eq(task.id, id), eq(task.userId, userId)));
      // Moving a task moves its subtasks; deleting it hides them too.
      if (fields.projectId !== undefined)
        await tx.update(task).set({ projectId: fields.projectId }).where(and(eq(task.parentId, id), eq(task.userId, userId)));
    }
    if (labels) await setLabels(tx, userId, id, labels);
  });

  if (patch.dueDate !== undefined || patch.dueTime !== undefined || completed === false || deleted === false)
    await recomputeTaskReminders(db, userId, id);

  const [row] = await db.select(taskColumns).from(task).where(eq(task.id, id));
  return toTask(row);
}

/* ------------------------------ Projects ------------------------------ */

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      color: project.color,
      sortKey: project.sortKey,
      openCount: sql<number>`(select count(*)::int from task t where t.project_id = ${OUTER_PROJECT_ID} and t.completed_at is null and t.deleted_at is null and t.parent_id is null)`,
    })
    .from(project)
    .where(and(eq(project.userId, userId), isNull(project.archivedAt)))
    .orderBy(asc(project.sortKey));
  return rows.map((r) => ({ ...r, color: r.color as Project["color"], openCount: Number(r.openCount) }));
}

export async function createProject(userId: string, input: { id?: string; name: string; color?: string }) {
  const [last] = await db
    .select({ k: project.sortKey })
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.sortKey))
    .limit(1);
  const [row] = await db
    .insert(project)
    .values({
      ...(input.id ? { id: input.id } : {}),
      userId,
      name: input.name,
      color: input.color ?? "ink",
      sortKey: generateKeyBetween(last?.k ?? null, null),
    })
    .returning();
  return { id: row.id, name: row.name, color: row.color as Project["color"], sortKey: row.sortKey, openCount: 0 };
}

export async function updateProject(
  userId: string,
  id: string,
  input: { name?: string; color?: string; sortKey?: string; archived?: boolean },
) {
  const { archived, ...fields } = input;
  const [row] = await db
    .update(project)
    .set({ ...fields, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}) })
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .returning();
  if (!row) throw new ClientError("That project doesn’t exist.", 404);
  return row;
}

export async function deleteProject(userId: string, id: string) {
  const rows = await db.delete(project).where(and(eq(project.id, id), eq(project.userId, userId))).returning({ id: project.id });
  if (!rows.length) throw new ClientError("That project doesn’t exist.", 404);
}

export async function getCounts(userId: string, today: string): Promise<Omit<Counts, "labels">> {
  const [row] = await db
    .select({
      inbox: sql<number>`count(*) filter (where ${task.projectId} is null)::int`,
      today: sql<number>`count(*) filter (where ${task.dueDate} <= ${today})::int`,
      overdue: sql<number>`count(*) filter (where ${task.dueDate} < ${today})::int`,
    })
    .from(task)
    .where(open(userId));
  return { inbox: Number(row.inbox), today: Number(row.today), overdue: Number(row.overdue) };
}

export async function listLabels(userId: string) {
  return db.select({ id: label.id, name: label.name }).from(label).where(eq(label.userId, userId)).orderBy(asc(sql`lower(${label.name})`));
}

/* ------------------------------ Search ------------------------------ */

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => "\\" + c);

/**
 * Title and notes, open and done. Ranked: title starts with the query, then title contains,
 * then notes; open before completed; recent first. ILIKE over one user's rows stays fast
 * well past 10k tasks; swap for pg_trgm/FTS if that ever changes.
 */
export async function searchTasks(userId: string, q: string): Promise<SearchHit[]> {
  const term = q.trim().slice(0, 100);
  if (!term) return [];
  const like = `%${escapeLike(term)}%`;
  const rank = sql`case when ${task.title} ilike ${escapeLike(term) + "%"} then 0 when ${task.title} ilike ${like} then 1 else 2 end`;
  const rows = await db
    .select({
      id: task.id,
      title: task.title,
      notes: task.notes,
      parentId: task.parentId,
      projectId: task.projectId,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
    })
    .from(task)
    .where(and(eq(task.userId, userId), isNull(task.deletedAt), or(ilike(task.title, like), ilike(task.notes, like))))
    .orderBy(rank, sql`${task.completedAt} is not null`, desc(task.updatedAt))
    .limit(20);
  return rows.map((r) => {
    const inTitle = r.title.toLowerCase().includes(term.toLowerCase());
    let snippet: string | null = null;
    if (!inTitle) {
      const i = r.notes.toLowerCase().indexOf(term.toLowerCase());
      const from = Math.max(0, i - 30);
      snippet = (from > 0 ? "…" : "") + r.notes.slice(from, i + term.length + 50).replace(/\s+/g, " ") + (i + term.length + 50 < r.notes.length ? "…" : "");
    }
    return {
      id: r.id,
      title: r.title,
      parentId: r.parentId,
      projectId: r.projectId,
      dueDate: r.dueDate,
      completed: !!r.completedAt,
      field: inTitle ? "title" : "notes",
      snippet,
    };
  });
}

/* ------------------------------ Saved filters ------------------------------ */

export async function listFilters(userId: string): Promise<SavedFilter[]> {
  return db
    .select({ id: savedFilter.id, name: savedFilter.name, query: savedFilter.query, sortKey: savedFilter.sortKey })
    .from(savedFilter)
    .where(eq(savedFilter.userId, userId))
    .orderBy(asc(savedFilter.sortKey));
}

export async function createFilter(userId: string, input: { id?: string; name: string; query: string }) {
  const [last] = await db
    .select({ k: savedFilter.sortKey })
    .from(savedFilter)
    .where(eq(savedFilter.userId, userId))
    .orderBy(desc(savedFilter.sortKey))
    .limit(1);
  const [row] = await db
    .insert(savedFilter)
    .values({ ...(input.id ? { id: input.id } : {}), userId, name: input.name, query: input.query, sortKey: generateKeyBetween(last?.k ?? null, null) })
    .returning({ id: savedFilter.id, name: savedFilter.name, query: savedFilter.query, sortKey: savedFilter.sortKey });
  return row;
}

export async function updateFilter(userId: string, id: string, patch: { name?: string; query?: string }) {
  const [row] = await db
    .update(savedFilter)
    .set(patch)
    .where(and(eq(savedFilter.id, id), eq(savedFilter.userId, userId)))
    .returning({ id: savedFilter.id, name: savedFilter.name, query: savedFilter.query, sortKey: savedFilter.sortKey });
  if (!row) throw new ClientError("That filter doesn’t exist any more.", 404);
  return row;
}

export async function deleteFilter(userId: string, id: string) {
  const rows = await db.delete(savedFilter).where(and(eq(savedFilter.id, id), eq(savedFilter.userId, userId))).returning({ id: savedFilter.id });
  if (!rows.length) throw new ClientError("That filter doesn’t exist any more.", 404);
}

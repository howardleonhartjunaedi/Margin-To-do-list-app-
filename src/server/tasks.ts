import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, lte, sql, type SQL } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import type { Counts, Project, Task } from "@/lib/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";
import { db } from "./db";
import { label, project, task, taskLabel } from "./db/schema";

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
  dueDate: task.dueDate,
  dueTime: task.dueTime,
  recurrence: task.recurrence,
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
    dueDate: (r.dueDate as string) ?? null,
    dueTime: r.dueTime ? String(r.dueTime).slice(0, 5) : null,
    recurrence: (r.recurrence as string) ?? null,
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

export type ViewQuery =
  | { view: "inbox" }
  | { view: "today"; today: string }
  | { view: "upcoming"; today: string; to: string }
  | { view: "project"; id: string };

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

export async function createTask(userId: string, input: CreateTaskInput): Promise<Task> {
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
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        recurrence: input.recurrence ?? null,
        sortKey,
      })
      .returning({ id: task.id });
    if (input.labels?.length) await setLabels(tx, userId, row.id, input.labels);
    return row.id;
  });
  return (await getTaskWithSubtasks(userId, id)).task;
}

export async function updateTask(userId: string, id: string, input: UpdateTaskInput): Promise<Task> {
  const [existing] = await db.select({ id: task.id }).from(task).where(and(eq(task.id, id), eq(task.userId, userId)));
  if (!existing) throw new ClientError("That task doesn’t exist any more.", 404);
  if (input.projectId !== undefined) await assertProject(userId, input.projectId);

  const { completed, deleted, labels, ...fields } = input;
  const patch: Partial<typeof task.$inferInsert> = { ...fields };
  if (completed !== undefined) patch.completedAt = completed ? new Date() : null;
  if (deleted !== undefined) patch.deletedAt = deleted ? new Date() : null;
  if (fields.dueDate === null) patch.dueTime = null; // no time without a day

  await db.transaction(async (tx) => {
    if (Object.keys(patch).length) {
      await tx.update(task).set(patch).where(and(eq(task.id, id), eq(task.userId, userId)));
      // Moving a task moves its subtasks; deleting it hides them too.
      if (fields.projectId !== undefined)
        await tx.update(task).set({ projectId: fields.projectId }).where(and(eq(task.parentId, id), eq(task.userId, userId)));
    }
    if (labels) await setLabels(tx, userId, id, labels);
  });

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

import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { csvObjects, toCsv } from "@/lib/csv";
import { buildCalendar } from "@/lib/ical";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { instantToZoned } from "@/lib/time/zone";
import { atLeast, forMe, visibleTask, type Role } from "./access";
import { db } from "./db";
import { habit, habitCheck, label, project, projectMember, savedFilter, task, taskLabel, userSettings } from "./db/schema";
import { ClientError } from "./errors";
import { publish } from "./events";
import { getSettings } from "./reminders";

const baseUrl = () => process.env.BETTER_AUTH_URL ?? "";

/* ------------------------------ iCal feed ------------------------------ */

export async function feedStatus(userId: string) {
  const s = await getSettings(db, userId);
  return { enabled: !!s.icalToken, url: s.icalToken ? `${baseUrl()}/api/ical/${s.icalToken}.ics` : null };
}

/** Turn the feed on, or give it a new secret (the old URL stops working). */
export async function rotateFeed(userId: string) {
  await getSettings(db, userId);
  await db.update(userSettings).set({ icalToken: randomBytes(24).toString("base64url") }).where(eq(userSettings.userId, userId));
  return feedStatus(userId);
}

export async function disableFeed(userId: string) {
  await db.update(userSettings).set({ icalToken: null }).where(eq(userSettings.userId, userId));
  return feedStatus(userId);
}

/** The .ics body for a feed token, or null if the token isn't valid. */
export async function feedFor(token: string) {
  const [s] = await db.select().from(userSettings).where(eq(userSettings.icalToken, token));
  if (!s) return null;
  const rows = await db
    .select({ t: task, projectName: project.name })
    .from(task)
    .leftJoin(project, eq(project.id, task.projectId))
    .where(and(visibleTask(s.userId), forMe(s.userId), isNull(task.completedAt), isNull(task.deletedAt), isNotNull(task.dueDate)))
    .orderBy(asc(task.dueDate))
    .limit(2000);
  return buildCalendar(
    rows.map(({ t, projectName }) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      startDate: t.startDate,
      dueDate: t.dueDate!,
      dueTime: t.dueTime,
      estimateMinutes: t.estimateMinutes,
      recurrence: t.recurrence,
      priority: t.priority,
      projectName,
      updatedAt: t.updatedAt,
    })),
    { name: "Margin", timeZone: s.timeZone, baseUrl: baseUrl() },
  );
}

/* ------------------------------ Export ------------------------------ */

async function exportRows(userId: string) {
  const projects = await db
    .select({ id: project.id, name: project.name, color: project.color, role: projectMember.role })
    .from(project)
    .innerJoin(projectMember, and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId)))
    .orderBy(asc(project.sortKey));
  const tasks = await db
    .select({
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
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      labels: sql<string[]>`coalesce((select array_agg(l.name order by lower(l.name)) from task_label tl join label l on l.id = tl.label_id where tl.task_id = ${sql.raw('"task"."id"')} and l.user_id = ${userId}), '{}')`,
    })
    .from(task)
    .where(and(visibleTask(userId), isNull(task.deletedAt)))
    .orderBy(asc(task.createdAt));
  return { projects, tasks };
}

export async function exportJson(userId: string) {
  const { projects, tasks } = await exportRows(userId);
  const [habits, checks, filters] = await Promise.all([
    db.select().from(habit).where(eq(habit.userId, userId)),
    db
      .select({ habitId: habitCheck.habitId, date: habitCheck.date })
      .from(habitCheck)
      .innerJoin(habit, eq(habit.id, habitCheck.habitId))
      .where(eq(habit.userId, userId)),
    db.select({ name: savedFilter.name, query: savedFilter.query }).from(savedFilter).where(eq(savedFilter.userId, userId)),
  ]);
  return {
    format: "margin-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, role: p.role })),
    tasks: tasks.map((t) => ({ ...t, dueTime: t.dueTime?.slice(0, 5) ?? null, completedAt: t.completedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })),
    habits: habits.map((h) => ({ name: h.name, color: h.color, targetPerWeek: h.targetPerWeek, archived: !!h.archivedAt, checks: checks.filter((c) => c.habitId === h.id).map((c) => c.date) })),
    filters,
  };
}

export async function exportCsv(userId: string) {
  const { projects, tasks } = await exportRows(userId);
  const name = new Map(projects.map((p) => [p.id, p.name]));
  const title = new Map(tasks.map((t) => [t.id, t.title]));
  return toCsv([
    ["title", "notes", "project", "parent", "priority", "start_date", "due_date", "due_time", "recurrence", "estimate_minutes", "labels", "completed_at", "created_at"],
    ...tasks.map((t) => [
      t.title,
      t.notes,
      t.projectId ? (name.get(t.projectId) ?? "") : "",
      t.parentId ? (title.get(t.parentId) ?? "") : "",
      `p${t.priority}`,
      t.startDate,
      t.dueDate,
      t.dueTime?.slice(0, 5),
      t.recurrence,
      t.estimateMinutes,
      t.labels.join(", "),
      t.completedAt?.toISOString(),
      t.createdAt.toISOString(),
    ]),
  ]);
}

/* ------------------------------ Import ------------------------------ */

export const IMPORT_LIMIT = 5000;

interface Draft {
  ref: string;
  parentRef: string | null;
  projectName: string | null;
  title: string;
  notes: string;
  priority: 1 | 2 | 3 | 4;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  recurrence: string | null;
  estimateMinutes: number | null;
  labels: string[];
  completed: boolean;
}

const blank = (ref: string, title: string): Draft => ({
  ref,
  parentRef: null,
  projectName: null,
  title,
  notes: "",
  priority: 4,
  startDate: null,
  dueDate: null,
  dueTime: null,
  recurrence: null,
  estimateMinutes: null,
  labels: [],
  completed: false,
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const truthy = (v: string | undefined) => !!v && /^(x|true|yes|1|done|completed)$/i.test(v.trim());

function fromText(content: string, now: Date, projects: { id: string; name: string }[]): Draft[] {
  const out: Draft[] = [];
  let lastTop: string | null = null;
  content.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const indented = /^(\t| {2,})/.test(raw);
    let line = raw.trim().replace(/^[-*•]\s+/, "");
    const done = /^\[[xX]\]\s*/.test(line);
    line = line.replace(/^\[[ xX]?\]\s*/, "");
    if (!line) return;
    const p = parseQuickAdd(line, { now, projects });
    const d: Draft = {
      ...blank(`t${i}`, p.title || line),
      parentRef: indented ? lastTop : null,
      projectName: p.project?.name ?? (p.unknownProject ? p.unknownProject[0].toUpperCase() + p.unknownProject.slice(1) : null),
      priority: p.priority,
      dueDate: p.dueDate,
      dueTime: p.dueDate ? p.dueTime : null,
      recurrence: p.recurrence?.rrule ?? null,
      estimateMinutes: p.estimateMinutes,
      labels: p.labels,
      completed: done,
    };
    if (!indented) lastTop = d.ref;
    out.push(d);
  });
  return out;
}

function fromCsv(content: string, now: Date, projects: { id: string; name: string }[]): Draft[] {
  const rows = csvObjects(content);
  if (!rows.length) return [];
  const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v) ?? "";
  if (!rows.some((r) => pick(r, "title", "content", "task", "name")))
    throw new ClientError("Couldn’t find a title column. Name one column “title”.", 422);
  const titles = new Map<string, string>();
  return rows
    .map((r, i): Draft | null => {
      const title = pick(r, "title", "content", "task", "name");
      if (!title) return null;
      const ref = `r${i}`;
      titles.set(title.toLowerCase(), ref);
      const pr = pick(r, "priority").toLowerCase().replace(/^p/, "");
      const dueRaw = pick(r, "due_date", "due date", "due", "date");
      let dueDate: string | null = null;
      let dueTime: string | null = /^\d{1,2}:\d{2}$/.test(pick(r, "due_time", "time")) ? pick(r, "due_time", "time").padStart(5, "0") : null;
      if (ISO.test(dueRaw)) dueDate = dueRaw;
      else if (dueRaw) {
        const p = parseQuickAdd(dueRaw, { now, projects });
        dueDate = p.dueDate;
        dueTime = dueTime ?? p.dueTime;
      }
      const est = Number(pick(r, "estimate_minutes", "estimate"));
      return {
        ...blank(ref, title.slice(0, 500)),
        parentRef: null,
        projectName: pick(r, "project", "list") || null,
        notes: pick(r, "notes", "description").slice(0, 20_000),
        priority: (["1", "2", "3", "4"].includes(pr) ? Number(pr) : 4) as Draft["priority"],
        startDate: ISO.test(pick(r, "start_date", "start")) && dueDate ? pick(r, "start_date", "start") : null,
        dueDate,
        dueTime: dueDate ? dueTime : null,
        recurrence: /^FREQ=/.test(pick(r, "recurrence")) ? pick(r, "recurrence") : null,
        estimateMinutes: est > 0 && est <= 1440 ? Math.round(est) : null,
        labels: pick(r, "labels", "tags").split(/[,;]/).map((l) => l.trim().replace(/^@/, "")).filter(Boolean),
        completed: truthy(pick(r, "completed", "done")) || !!pick(r, "completed_at"),
        // remember the parent title; resolved below
        ...(pick(r, "parent") ? { parentRef: `title:${pick(r, "parent").toLowerCase()}` } : {}),
      };
    })
    .filter((d): d is Draft => !!d)
    .map((d) => (d.parentRef?.startsWith("title:") ? { ...d, parentRef: titles.get(d.parentRef.slice(6)) ?? null } : d));
}

function fromJson(content: string): Draft[] {
  let data: { format?: string; projects?: { id: string; name: string }[]; tasks?: Record<string, unknown>[] };
  try {
    data = JSON.parse(content);
  } catch {
    throw new ClientError("That file isn’t valid JSON.", 422);
  }
  if (data.format !== "margin-export" || !Array.isArray(data.tasks)) throw new ClientError("That JSON isn’t a Margin export.", 422);
  const projects = new Map((data.projects ?? []).map((p) => [p.id, p.name]));
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  return data.tasks.map((t) => ({
    ...blank(String(t.id), String(t.title ?? "Untitled").slice(0, 500)),
    parentRef: s(t.parentId),
    projectName: t.projectId ? (projects.get(String(t.projectId)) ?? null) : null,
    notes: (s(t.notes) ?? "").slice(0, 20_000),
    priority: ([1, 2, 3, 4].includes(Number(t.priority)) ? Number(t.priority) : 4) as Draft["priority"],
    startDate: ISO.test(s(t.startDate) ?? "") ? s(t.startDate) : null,
    dueDate: ISO.test(s(t.dueDate) ?? "") ? s(t.dueDate) : null,
    dueTime: /^\d{2}:\d{2}$/.test(s(t.dueTime) ?? "") ? s(t.dueTime) : null,
    recurrence: /^FREQ=/.test(s(t.recurrence) ?? "") ? s(t.recurrence) : null,
    estimateMinutes: Number(t.estimateMinutes) > 0 ? Math.min(1440, Math.round(Number(t.estimateMinutes))) : null,
    labels: Array.isArray(t.labels) ? (t.labels as unknown[]).map(String).slice(0, 20) : [],
    completed: !!t.completedAt,
  }));
}

export async function importData(userId: string, input: { format: "json" | "csv" | "text"; content: string; dryRun?: boolean }) {
  if (input.content.length > 2_000_000) throw new ClientError("That file is over 2 MB. Split it into smaller files.", 413);
  const s = await getSettings(db, userId);
  const z = instantToZoned(new Date(), s.timeZone);
  const now = new Date(`${z.date}T${z.time}:00`); // the user's wall clock, for "tomorrow" etc.
  const mine = await db
    .select({ id: project.id, name: project.name, role: projectMember.role })
    .from(project)
    .innerJoin(projectMember, and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId)));
  const writable = mine.filter((p) => atLeast(p.role as Role, "editor"));

  const drafts = input.format === "json" ? fromJson(input.content) : input.format === "csv" ? fromCsv(input.content, now, writable) : fromText(input.content, now, writable);
  if (!drafts.length) throw new ClientError("Nothing to import — the file looks empty.", 422);
  if (drafts.length > IMPORT_LIMIT) throw new ClientError(`That’s ${drafts.length} tasks; the limit is ${IMPORT_LIMIT} per import.`, 413);

  const byName = new Map(writable.map((p) => [p.name.toLowerCase(), p.id]));
  const newProjects = [...new Set(drafts.map((d) => d.projectName).filter((n): n is string => !!n && !byName.has(n.toLowerCase())))];
  const summary = {
    tasks: drafts.filter((d) => !d.parentRef).length,
    subtasks: drafts.filter((d) => d.parentRef).length,
    completed: drafts.filter((d) => d.completed).length,
    newProjects,
    sample: drafts.slice(0, 5).map((d) => d.title),
  };
  if (input.dryRun) return { ...summary, imported: false };

  // Projects first.
  let [{ k: projectKey }] = await db.select({ k: sql<string | null>`max(${project.sortKey})` }).from(project).where(eq(project.userId, userId));
  for (const name of newProjects) {
    projectKey = generateKeyBetween(projectKey, null);
    const [p] = await db.insert(project).values({ userId, name: name.slice(0, 120), color: "ink", sortKey: projectKey }).returning({ id: project.id });
    await db.insert(projectMember).values({ projectId: p.id, userId, role: "owner" });
    byName.set(name.toLowerCase(), p.id);
  }

  // Tasks: parents before children, each list appended after what's already there.
  const ids = new Map(drafts.map((d) => [d.ref, crypto.randomUUID()]));
  const lastKey = new Map<string, string | null>();
  const keyFor = async (scope: string, where: ReturnType<typeof and>) => {
    if (!lastKey.has(scope)) {
      const [r] = await db.select({ k: sql<string>`max(${task.sortKey})` }).from(task).where(where);
      lastKey.set(scope, r?.k ?? null);
    }
    const k = generateKeyBetween(lastKey.get(scope)!, null);
    lastKey.set(scope, k);
    return k;
  };
  const rows: (typeof task.$inferInsert)[] = [];
  const ordered = [...drafts.filter((d) => !d.parentRef || !ids.has(d.parentRef)), ...drafts.filter((d) => d.parentRef && ids.has(d.parentRef))];
  const parentProject = new Map<string, string | null>();
  for (const d of ordered) {
    const parentId = d.parentRef && ids.has(d.parentRef) ? ids.get(d.parentRef)! : null;
    const projectId = parentId ? (parentProject.get(parentId) ?? null) : d.projectName ? (byName.get(d.projectName.toLowerCase()) ?? null) : null;
    const id = ids.get(d.ref)!;
    parentProject.set(id, projectId);
    const scope = parentId ? `p:${parentId}` : projectId ? `j:${projectId}` : "inbox";
    const where = parentId
      ? eq(task.parentId, parentId)
      : projectId
        ? and(isNull(task.parentId), eq(task.projectId, projectId))
        : and(isNull(task.parentId), isNull(task.projectId), eq(task.userId, userId));
    rows.push({
      id,
      userId,
      projectId,
      parentId,
      title: d.title,
      notes: d.notes,
      priority: d.priority,
      startDate: d.startDate && d.dueDate && d.startDate <= d.dueDate ? d.startDate : null,
      dueDate: d.dueDate,
      dueTime: d.dueTime,
      recurrence: d.recurrence,
      estimateMinutes: d.estimateMinutes,
      completedAt: d.completed ? new Date() : null,
      sortKey: await keyFor(scope, where),
    });
  }
  for (let i = 0; i < rows.length; i += 500) await db.insert(task).values(rows.slice(i, i + 500));

  // Labels, in bulk.
  const names = [...new Map(drafts.flatMap((d) => d.labels).map((l) => [l.toLowerCase(), l])).values()];
  if (names.length) {
    await db.insert(label).values(names.map((name) => ({ userId, name }))).onConflictDoNothing();
    const ls = await db
      .select({ id: label.id, name: label.name })
      .from(label)
      .where(and(eq(label.userId, userId), inArray(sql`lower(${label.name})`, names.map((n) => n.toLowerCase()))));
    const lid = new Map(ls.map((l) => [l.name.toLowerCase(), l.id]));
    const links = drafts.flatMap((d) => [...new Set(d.labels.map((l) => l.toLowerCase()))].map((l) => ({ taskId: ids.get(d.ref)!, labelId: lid.get(l)! })).filter((x) => x.labelId));
    for (let i = 0; i < links.length; i += 1000) await db.insert(taskLabel).values(links.slice(i, i + 1000)).onConflictDoNothing();
  }

  publish([userId], { type: "project" });
  return { ...summary, imported: true };
}

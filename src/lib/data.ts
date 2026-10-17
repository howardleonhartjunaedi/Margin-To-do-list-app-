"use client";

import { useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast, toastWithUndo } from "@/components/ui/toast";
import { api, ApiError } from "./api";
import type { Project, Task, View } from "./types";
import type { CreateTaskInput, UpdateTaskInput } from "./validation";

/*
 * Client data layer. Every mutation is optimistic:
 *   1. snapshot the caches, 2. write the expected result into every list it belongs to,
 *   3. send it, 4. on success merge the server's version, on failure roll back and say why.
 * Lists are never refetched after our own writes — that's what keeps rows from jumping.
 */

type Detail = { task: Task; subtasks: Task[] };

export const keys = {
  tasks: (v: View) => ["tasks", v] as const,
  task: (id: string) => ["task", id] as const,
  projects: ["projects"] as const,
  counts: (today: string) => ["counts", today] as const,
};

export const useTasks = (v: View) => useQuery({ queryKey: keys.tasks(v), queryFn: () => api.tasks(v) });
export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: api.projects });
export const useCounts = (today: string) => useQuery({ queryKey: keys.counts(today), queryFn: () => api.counts(today) });
export const useTaskDetail = (id: string | null) =>
  useQuery({ queryKey: keys.task(id ?? ""), queryFn: () => api.task(id!), enabled: !!id });

/* ------------------------------ View rules (mirror the server) ------------------------------ */

export function belongsTo(t: Task, v: View): boolean {
  if (t.parentId) return false;
  switch (v.kind) {
    case "inbox":
      return !t.projectId;
    case "today":
      return !!t.dueDate && t.dueDate <= v.today;
    case "upcoming":
      return !!t.dueDate && t.dueDate < v.to;
    case "project":
      return t.projectId === v.id;
  }
}

const bySortKey = (a: Task, b: Task) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);
const byDue = (a: Task, b: Task) =>
  (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
  (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
  a.priority - b.priority ||
  bySortKey(a, b);

export const comparatorFor = (v: View) => (v.kind === "today" || v.kind === "upcoming" ? byDue : bySortKey);
export const isManualOrder = (v: View) => v.kind === "inbox" || v.kind === "project";

function insertSorted(list: Task[], t: Task, cmp: (a: Task, b: Task) => number) {
  const i = list.findIndex((x) => cmp(t, x) < 0);
  return i === -1 ? [...list, t] : [...list.slice(0, i), t, ...list.slice(i)];
}

/** Put `t` (or remove it, when `removed`) in every cached list and detail view. */
function writeEverywhere(qc: QueryClient, t: Task, removed = false) {
  for (const [key, list] of qc.getQueriesData<Task[]>({ queryKey: ["tasks"] })) {
    if (!list) continue;
    const v = key[1] as View;
    const i = list.findIndex((x) => x.id === t.id);
    const keep = !removed && belongsTo(t, v);
    let next: Task[];
    if (i !== -1 && keep && comparatorFor(v)(t, list[i]) === 0 && isManualOrder(v)) {
      next = list.with(i, t); // same slot: replace in place
    } else {
      const without = i === -1 ? list : list.toSpliced(i, 1);
      next = keep ? insertSorted(without, t, comparatorFor(v)) : without;
    }
    if (next !== list) qc.setQueryData(key, next);
  }
  qc.setQueryData<Detail>(keys.task(t.id), (d) => (d ? { ...d, task: t } : d));
  const d = t.parentId ? qc.getQueryData<Detail>(keys.task(t.parentId)) : undefined;
  if (d) {
    const subs = removed
      ? d.subtasks.filter((s) => s.id !== t.id)
      : d.subtasks.some((s) => s.id === t.id)
        ? d.subtasks.map((s) => (s.id === t.id ? t : s))
        : [...d.subtasks, t];
    const parent = { ...d.task, subtaskCount: subs.length, subtaskDone: subs.filter((s) => s.completedAt).length };
    qc.setQueryData<Detail>(keys.task(parent.id), { task: parent, subtasks: subs });
    writeEverywhere(qc, parent); // parent's "2/5" in every list
  }
}

function snapshot(qc: QueryClient) {
  const saved: [QueryKey, unknown][] = [
    ...qc.getQueriesData({ queryKey: ["tasks"] }),
    ...qc.getQueriesData({ queryKey: ["task"] }),
    ...qc.getQueriesData({ queryKey: ["projects"] }),
  ];
  return () => saved.forEach(([k, d]) => qc.setQueryData(k, d));
}

function applyPatch(t: Task, p: UpdateTaskInput): Task {
  const { completed, deleted: _deleted, ...rest } = p;
  const next: Task = { ...t, ...rest } as Task;
  if (completed !== undefined) next.completedAt = completed ? new Date().toISOString() : null;
  if (p.dueDate === null) next.dueTime = null;
  return next;
}

function refreshCounts(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["counts"] });
  qc.invalidateQueries({ queryKey: keys.projects });
}

const failed = (e: unknown) => toast(e instanceof ApiError ? e.message : "Something went wrong. Your change wasn’t saved.");

/* ------------------------------ Task actions ------------------------------ */

export function useTaskActions() {
  const qc = useQueryClient();

  const update = useCallback(
    async (t: Task, patch: UpdateTaskInput, opts: { message?: string; undo?: UpdateTaskInput } = {}) => {
      const restore = snapshot(qc);
      const optimistic = applyPatch(t, patch);
      writeEverywhere(qc, optimistic, patch.deleted === true);
      if (opts.message) {
        const undo = opts.undo;
        if (undo) toastWithUndo(opts.message, () => void update(optimistic, undo));
        else toast(opts.message);
      }
      try {
        const saved = await api.updateTask(t.id, patch);
        // Keep the optimistic completedAt so a lingering row doesn't flicker.
        if (patch.deleted !== true) writeEverywhere(qc, { ...saved, completedAt: saved.completedAt && optimistic.completedAt });
        refreshCounts(qc);
        return saved;
      } catch (e) {
        restore();
        failed(e);
      }
    },
    [qc],
  );

  const create = useCallback(
    async (input: CreateTaskInput & { id: string }) => {
      const restore = snapshot(qc);
      const optimistic: Task = {
        id: input.id,
        projectId: input.projectId ?? null,
        parentId: input.parentId ?? null,
        title: input.title,
        notes: input.notes ?? "",
        priority: input.priority ?? 4,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        recurrence: input.recurrence ?? null,
        sortKey: "￿", // sorts last until the server assigns the real key
        completedAt: null,
        createdAt: new Date().toISOString(),
        labels: input.labels ?? [],
        subtaskCount: 0,
        subtaskDone: 0,
      };
      writeEverywhere(qc, optimistic);
      try {
        const saved = await api.createTask(input);
        writeEverywhere(qc, saved);
        refreshCounts(qc);
        return saved;
      } catch (e) {
        restore();
        failed(e);
      }
    },
    [qc],
  );

  return {
    update,
    create,
    complete: (t: Task) =>
      update(t, { completed: true }, { message: `Completed “${truncate(t.title)}”.`, undo: { completed: false } }),
    uncomplete: (t: Task) => update(t, { completed: false }),
    remove: (t: Task) => update(t, { deleted: true }, { message: `Deleted “${truncate(t.title)}”.`, undo: { deleted: false } }),
    reschedule: (t: Task, dueDate: string | null, label: string) =>
      update(t, { dueDate }, { message: dueDate ? `Moved to ${label}.` : "Removed the date.", undo: { dueDate: t.dueDate, dueTime: t.dueTime } }),
  };
}

/* ------------------------------ Project actions ------------------------------ */

export function useProjectActions() {
  const qc = useQueryClient();
  return {
    create: async (input: { id: string; name: string; color?: string }) => {
      const restore = snapshot(qc);
      qc.setQueryData<Project[]>(keys.projects, (ps) => [
        ...(ps ?? []),
        { id: input.id, name: input.name, color: (input.color ?? "ink") as Project["color"], sortKey: "￿", openCount: 0 },
      ]);
      try {
        const saved = await api.createProject(input);
        qc.setQueryData<Project[]>(keys.projects, (ps) => ps?.map((p) => (p.id === saved.id ? saved : p)));
        return saved;
      } catch (e) {
        restore();
        failed(e);
      }
    },
    update: async (id: string, patch: { name?: string; color?: string }) => {
      const restore = snapshot(qc);
      qc.setQueryData<Project[]>(keys.projects, (ps) => ps?.map((p) => (p.id === id ? ({ ...p, ...patch } as Project) : p)));
      try {
        await api.updateProject(id, patch);
      } catch (e) {
        restore();
        failed(e);
      }
    },
    remove: async (id: string) => {
      const restore = snapshot(qc);
      qc.setQueryData<Project[]>(keys.projects, (ps) => ps?.filter((p) => p.id !== id));
      try {
        await api.deleteProject(id);
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["counts"] });
        return true;
      } catch (e) {
        restore();
        failed(e);
        return false;
      }
    },
  };
}

export const truncate = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

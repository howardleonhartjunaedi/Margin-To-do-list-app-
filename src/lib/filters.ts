import { addDays, type ISODate } from "./dates";
import type { Priority, Project, Task } from "./types";
import { m } from "@/i18n/catalogs";

/*
 * A filter narrows any task set. Within a field, values are OR'ed ("P1 or P2");
 * across fields they're AND'ed ("…and in Work"). Empty field = no constraint.
 *
 * Encoded compactly for the ?f= URL param and saved filters:
 *   p:1,2;pr:<projectId>,inbox;l:calls,errands;d:overdue,today;q:<uri-encoded text>
 */

export type DueBucket = "overdue" | "today" | "week" | "dated" | "none";

export interface Filter {
  priorities: Priority[];
  projects: string[]; // project ids, or "inbox"
  labels: string[];
  due: DueBucket[];
  text: string;
}

export const EMPTY_FILTER: Filter = { priorities: [], projects: [], labels: [], due: [], text: "" };

const DUE: DueBucket[] = ["overdue", "today", "week", "dated", "none"];
export const DUE_BUCKETS: DueBucket[] = ["overdue", "today", "week", "dated", "none"];

/** "Overdue", "Next 7 days"… in the language on screen. */
export const dueLabel = (d: DueBucket) => m().filter.due[d];

export function isEmptyFilter(f: Filter) {
  return !f.priorities.length && !f.projects.length && !f.labels.length && !f.due.length && !f.text.trim();
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function encodeFilter(f: Filter): string {
  const parts: string[] = [];
  if (f.priorities.length) parts.push(`p:${[...f.priorities].sort().join(",")}`);
  if (f.projects.length) parts.push(`pr:${f.projects.map(encodeURIComponent).join(",")}`);
  if (f.labels.length) parts.push(`l:${f.labels.map(encodeURIComponent).join(",")}`);
  if (f.due.length) parts.push(`d:${f.due.join(",")}`);
  if (f.text.trim()) parts.push(`q:${encodeURIComponent(f.text.trim())}`);
  return parts.join(";");
}

/** Tolerant: unknown keys and values are dropped, never thrown. */
export function decodeFilter(s: string | null | undefined): Filter {
  const f: Filter = { priorities: [], projects: [], labels: [], due: [], text: "" };
  if (!s) return f;
  for (const part of s.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i);
    const val = part.slice(i + 1);
    const safe = (x: string) => {
      try {
        return decodeURIComponent(x);
      } catch {
        return x;
      }
    };
    if (key === "p") f.priorities = [...new Set(list(val).map(Number).filter((n): n is Priority => [1, 2, 3, 4].includes(n)))];
    else if (key === "pr") f.projects = [...new Set(list(val).map(safe))];
    else if (key === "l") f.labels = [...new Set(list(val).map(safe))];
    else if (key === "d") f.due = [...new Set(list(val).filter((d): d is DueBucket => DUE.includes(d as DueBucket)))];
    else if (key === "q") f.text = safe(val);
  }
  return f;
}

function dueMatches(t: Task, b: DueBucket, today: ISODate) {
  switch (b) {
    case "overdue":
      return !!t.dueDate && t.dueDate < today;
    case "today":
      return t.dueDate === today;
    case "week":
      return !!t.dueDate && t.dueDate >= today && t.dueDate <= addDays(today, 6);
    case "dated":
      return !!t.dueDate;
    case "none":
      return !t.dueDate;
  }
}

export function matchesFilter(t: Task, f: Filter, today: ISODate): boolean {
  if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
  if (f.projects.length && !f.projects.includes(t.projectId ?? "inbox")) return false;
  if (f.labels.length) {
    const have = new Set(t.labels.map((l) => l.toLowerCase()));
    if (!f.labels.some((l) => have.has(l.toLowerCase()))) return false;
  }
  if (f.due.length && !f.due.some((b) => dueMatches(t, b, today))) return false;
  const q = f.text.trim().toLowerCase();
  if (q && !t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q)) return false;
  return true;
}

export const applyFilter = (tasks: Task[], f: Filter, today: ISODate) =>
  isEmptyFilter(f) ? tasks : tasks.filter((t) => matchesFilter(t, f, today));

/** "P1, P2 · Work · @calls · Overdue · “invoice”" */
export function describeFilter(f: Filter, projects: Pick<Project, "id" | "name">[] = []): string {
  const t = m();
  const parts: string[] = [];
  if (f.priorities.length) parts.push(f.priorities.map((p) => `P${p}`).join(", "));
  if (f.projects.length) parts.push(f.projects.map((id) => (id === "inbox" ? t.nav.inbox : (projects.find((p) => p.id === id)?.name ?? t.filter.deletedProject))).join(", "));
  if (f.labels.length) parts.push(f.labels.map((l) => `@${l}`).join(", "));
  if (f.due.length) parts.push(f.due.map(dueLabel).join(", "));
  if (f.text.trim()) parts.push(`“${f.text.trim()}”`);
  return parts.join(" · ") || t.filter.everythingOpen;
}

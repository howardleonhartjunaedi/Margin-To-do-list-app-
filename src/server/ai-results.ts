import { addDays } from "@/lib/dates";
import type { Priority } from "@/lib/types";

/*
 * Model output is untrusted: everything it returns is checked against what we actually sent
 * before the user sees it. Pure functions, so they're tested on their own (ai-results.test.ts).
 */

export interface RawStep {
  title: string;
  estimateMinutes: number | null;
}

export function cleanSteps(steps: RawStep[]) {
  return steps
    .map((s) => ({
      title: s.title.replace(/\s+/g, " ").trim().slice(0, 200),
      estimateMinutes: s.estimateMinutes && s.estimateMinutes > 0 ? Math.min(Math.round(s.estimateMinutes), 1440) : null,
    }))
    .filter((s) => s.title)
    .slice(0, 10);
}

export interface RawSuggestion {
  taskId: string;
  projectId: string | null;
  dueDate: string | null;
  priority: number;
  reason: string;
}

interface Ref<T> {
  get(ref: string): T | undefined;
}

export function cleanTriage(
  raw: RawSuggestion[],
  tasks: Ref<{ id: string; title: string; priority: Priority }>,
  projects: Ref<{ id: string; name: string }>,
  today: string,
) {
  const latest = addDays(today, 365);
  const seen = new Set<string>();
  const out = [];
  for (const sg of raw) {
    const t = tasks.get(sg.taskId);
    if (!t || seen.has(t.id)) continue; // unknown or repeated handle
    seen.add(t.id);
    const project = sg.projectId ? projects.get(sg.projectId) : undefined;
    const dueDate = sg.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(sg.dueDate) && sg.dueDate >= today && sg.dueDate <= latest ? sg.dueDate : null;
    const priority = ([1, 2, 3, 4] as const).find((p) => p === sg.priority) ?? 4;
    // A suggestion that changes nothing isn't worth showing.
    if (!project && !dueDate && priority === t.priority) continue;
    out.push({
      taskId: t.id,
      title: t.title,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      dueDate,
      priority,
      reason: sg.reason.replace(/\s+/g, " ").trim().slice(0, 140),
    });
  }
  return out;
}

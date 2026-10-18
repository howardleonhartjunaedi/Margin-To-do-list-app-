"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppUI } from "@/components/app/app-ui";
import { quickDates } from "@/components/tasks/reschedule";
import { cn } from "@/lib/cn";
import { useProjects, useTaskActions } from "@/lib/data";
import { addDays } from "@/lib/dates";
import type { Task } from "@/lib/types";
import type { UpdateTaskInput } from "@/lib/validation";
import { BoardCard } from "./board-card";
import { useT } from "@/i18n/client";
import { m } from "@/i18n/catalogs";

/*
 * Eisenhower matrix.
 *   Important = P1 or P2.   Urgent = due by tomorrow (or overdue).
 * Dragging between quadrants changes only what the move implies:
 *   → important: raise to P2 (if lower)      → not important: lower to P3 (if higher)
 *   → urgent: due today (if later/undated)   → not urgent: due next week (if sooner)
 */

type Quadrant = "do" | "schedule" | "delegate" | "drop";

const axisX = "hidden self-end font-mono text-2xs tracking-wider text-ink-3 uppercase sm:block";
const axisY =
  "hidden rotate-180 self-center justify-self-center font-mono text-2xs tracking-wider whitespace-nowrap text-ink-3 uppercase [writing-mode:vertical-rl] sm:block";

const QUADRANTS: Record<Quadrant, { important: boolean; urgent: boolean; tone: string }> = {
  do: { important: true, urgent: true, tone: "text-p1" },
  schedule: { important: true, urgent: false, tone: "text-p3" },
  delegate: { important: false, urgent: true, tone: "text-p2" },
  drop: { important: false, urgent: false, tone: "text-ink-3" },
};

export function quadrantOf(t: Task, today: string): Quadrant {
  const important = t.priority <= 2;
  const urgent = !!t.dueDate && t.dueDate <= addDays(today, 1);
  return important ? (urgent ? "do" : "schedule") : urgent ? "delegate" : "drop";
}

export function Matrix({ tasks, hideProject }: { tasks: Task[]; hideProject?: boolean }) {
  const tr = useT();
  const tl = tr.layouts;
  const { today, openTask } = useAppUI();
  const actions = useTaskActions();
  const projects = useProjects().data ?? [];
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const [active, setActive] = useState<Task | null>(null);
  const [shown, setShown] = useState<Partial<Record<Quadrant, number>>>({});
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );
  const groups = useMemo(() => {
    const g: Record<Quadrant, Task[]> = { do: [], schedule: [], delegate: [], drop: [] };
    for (const t of tasks) g[quadrantOf(t, today)].push(t);
    return g;
  }, [tasks, today]);

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    const t = tasks.find((x) => x.id === a.id);
    if (!t || !over) return;
    const to = QUADRANTS[over.id as Quadrant];
    const from = QUADRANTS[quadrantOf(t, today)];
    if (to === from) return;
    const patch: UpdateTaskInput = {};
    const undo: UpdateTaskInput = {};
    if (to.important !== from.important) {
      patch.priority = to.important ? 2 : 3;
      undo.priority = t.priority;
    }
    if (to.urgent !== from.urgent) {
      patch.dueDate = to.urgent ? today : quickDates(today)[3].date; // "Next week"
      undo.dueDate = t.dueDate;
      undo.dueTime = t.dueTime;
    }
    void actions.update(t, patch, { message: m().tasks.movedTo(`“${m().layouts.quadrants[over.id as Quadrant].title}”`), undo });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActive(tasks.find((t) => t.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {/* 3×3 grid: axis labels share rows/columns with the quadrants they describe. Phones: one column, no axes. */}
      <div className="grid gap-3 sm:grid-cols-[1.25rem_1fr_1fr] sm:grid-rows-[auto_1fr_1fr]">
        <span className="hidden sm:block" />
        <span className={axisX}>{tl.dueSoon}</span>
        <span className={axisX}>{tl.notPressing}</span>
        {(["do", "schedule", "delegate", "drop"] as Quadrant[]).map((q, i) => [
          i % 2 === 0 && (
            <span key={`axis-${q}`} className={axisY}>
              {i === 0 ? tl.important : tl.lessImportant}
            </span>
          ),
          <QuadrantBox key={q} id={q} count={groups[q].length}>
            {groups[q].slice(0, shown[q] ?? PAGE).map((t) => (
              <DraggableCard key={t.id} id={t.id} onOpen={() => openTask(t.id)}>
                <BoardCard
                  task={t}
                  today={today}
                  compact
                  project={t.projectId && !hideProject ? projectById.get(t.projectId) : undefined}
                  onOpen={() => openTask(t.id)}
                  onComplete={() => void actions.complete(t)}
                />
              </DraggableCard>
            ))}
            {groups[q].length > (shown[q] ?? PAGE) && (
              <li>
                <Button variant="ghost" size="sm" className="w-full text-ink-2" onClick={() => setShown((m) => ({ ...m, [q]: (m[q] ?? PAGE) + PAGE }))}>
                  {tr.common.showMore(Math.min(PAGE, groups[q].length - (shown[q] ?? PAGE)), groups[q].length - (shown[q] ?? PAGE))}
                </Button>
              </li>
            )}
          </QuadrantBox>,
        ])}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {active && <BoardCard task={active} today={today} compact lifted />}
      </DragOverlay>
    </DndContext>
  );
}

/** Cards rendered per quadrant at first; long ones grow on request. */
const PAGE = 20;

function QuadrantBox({ id, count, children }: { id: Quadrant; count: number; children: React.ReactNode }) {
  const q = { ...QUADRANTS[id], ...useT().layouts.quadrants[id] };
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={q.title}
      className={cn(
        "flex min-h-48 flex-col rounded-md p-3 ring-1 ring-line ring-inset transition-colors duration-(--dur-fast)",
        isOver ? "bg-accent-soft/60" : id === "do" ? "bg-surface" : "bg-bg",
      )}
    >
      <header className="mb-3 flex items-baseline gap-2">
        <h2 className={cn("font-display text-lg", q.tone)}>{q.title}</h2>
        <span className="font-mono text-2xs text-ink-3">{count}</span>
      </header>
      <p className="-mt-2 mb-3 text-xs text-ink-3">{q.hint}</p>
      <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto" data-lenis-prevent>
        {children}
      </ul>
    </section>
  );
}

function DraggableCard({ id, onOpen, children }: { id: string; onOpen: () => void; children: React.ReactNode }) {
  // A group, not a button: the card holds its own controls (complete, open).
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, attributes: { role: "group", roleDescription: "draggable task" } });
  return (
    // The list item stays a list item; the draggable is inside it.
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn(isDragging && "opacity-35")}>
      <div
        {...attributes}
        {...listeners}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) return onOpen();
          listeners?.onKeyDown?.(e);
        }}
        data-cursor="drag"
        className="touch-manipulation rounded-md"
      >
        {children}
      </div>
    </li>
  );
}

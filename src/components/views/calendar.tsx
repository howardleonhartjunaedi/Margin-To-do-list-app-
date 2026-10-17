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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ErrorState } from "@/components/ui/states";
import { duration, ease, spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useTaskActions, useTasks } from "@/lib/data";
import { addDays, daysBetween, formatDue, formatTime, fromISODate } from "@/lib/dates";
import { applyFilter, type Filter } from "@/lib/filters";
import type { Task, View } from "@/lib/types";
import { useUrlParam } from "@/lib/view-transition";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const MAX_CHIPS = 3;

function monthGrid(month: string) {
  const first = `${month}-01`;
  const offset = (fromISODate(first).getDay() + 6) % 7; // Monday-first
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
const shiftMonth = (month: string, n: number) => {
  const d = fromISODate(`${month}-01`);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const byTime = (a: Task, b: Task) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") || a.priority - b.priority;

/**
 * Month calendar. Drag a task to another day to reschedule it (spans keep their length);
 * click empty space in a day to add a task there. The grid keeps the native cursor:
 * hitting the right day matters more than flourish.
 */
export function CalendarLayout({ projectId, filter }: { projectId?: string; filter: Filter }) {
  const { today, openTask, openQuickAdd } = useAppUI();
  const actions = useTaskActions();
  const [month, setMonth] = useUrlParam("month", today.slice(0, 7));
  const dir = useRef(0);
  const days = useMemo(() => monthGrid(month), [month]);
  const view = useMemo<View>(() => ({ kind: "range", from: days[0], to: days[41], projectId }), [days, projectId]);
  const q = useTasks(view);
  const tasks = useMemo(() => applyFilter(q.data ?? [], filter, today), [q.data, filter, today]);
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.dueDate) m.set(t.dueDate, [...(m.get(t.dueDate) ?? []), t]);
    for (const list of m.values()) list.sort(byTime);
    return m;
  }, [tasks]);
  const [selected, setSelected] = useState(today);
  const [active, setActive] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );

  const go = (n: number) => {
    dir.current = n;
    setMonth(n === 0 ? today.slice(0, 7) : shiftMonth(month, n));
    if (n === 0) setSelected(today);
  };

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    const t = tasks.find((x) => x.id === a.id);
    const to = over?.id as string | undefined;
    if (!t || !to || !t.dueDate || to === t.dueDate) return;
    const delta = daysBetween(t.dueDate, to);
    void actions.update(
      t,
      { dueDate: to, ...(t.startDate ? { startDate: addDays(t.startDate, delta) } : {}) },
      { message: `Moved to ${formatDue(to, today)}.`, undo: { dueDate: t.dueDate, startDate: t.startDate, dueTime: t.dueTime } },
    );
  };

  const add = (date: string) => openQuickAdd({ dueDate: date, projectId: projectId ?? null });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 font-display text-2xl text-ink">{MONTH.format(fromISODate(`${month}-01`))}</h2>
        <Button size="sm" variant="ghost" onClick={() => go(0)} disabled={month === today.slice(0, 7)}>
          Today
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => go(-1)}>
          <Icon icon={ChevronLeft} />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => go(1)}>
          <Icon icon={ChevronRight} />
        </Button>
      </div>
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}

      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActive(tasks.find((t) => t.id === e.active.id) ?? null)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <div data-cursor="native" className="overflow-hidden rounded-md ring-1 ring-line">
          <div className="grid grid-cols-7 border-b border-line bg-surface">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1.5 text-center font-mono text-2xs text-ink-3">
                <span className="sm:hidden">{d[0]}</span>
                <span className="max-sm:hidden">{d}</span>
              </div>
            ))}
          </div>
          <AnimatePresence mode="popLayout" initial={false} custom={dir.current}>
            <motion.div
              key={month}
              custom={dir.current}
              initial={{ opacity: 0, x: dir.current * 16 }}
              animate={{ opacity: 1, x: 0, transition: { duration: duration.slow, ease: ease.enter } }}
              exit={{ opacity: 0, x: dir.current * -16, transition: { duration: duration.fast, ease: ease.exit } }}
              className="grid grid-cols-7 bg-line"
              style={{ gap: 1 }}
              role="grid"
              aria-label={MONTH.format(fromISODate(`${month}-01`))}
            >
              {days.map((d) => (
                <DayCell
                  key={d}
                  date={d}
                  today={today}
                  inMonth={d.startsWith(month)}
                  tasks={byDay.get(d) ?? []}
                  loading={q.isPending}
                  selected={selected === d}
                  onSelect={() => setSelected(d)}
                  onAdd={() => add(d)}
                  onOpen={openTask}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {active && <Chip task={active} lifted />}
        </DragOverlay>
      </DndContext>

      {/* Phone: the grid is an overview; the selected day's tasks read as a list. */}
      <section className="mt-5 sm:hidden" aria-live="polite">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-lg text-ink">{formatDue(selected, today)}</h3>
          <Button size="sm" variant="ghost" onClick={() => add(selected)}>
            <Icon icon={Plus} size="xs" /> Add
          </Button>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {(byDay.get(selected) ?? []).map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <TaskCheckbox checked={false} priority={t.priority} onCheckedChange={() => void actions.complete(t)} aria-label={`Complete: ${t.title}`} />
              <button className="min-w-0 flex-1 text-left text-base text-ink" onClick={() => openTask(t.id)}>
                {t.title}
              </button>
              {t.dueTime && <span className="font-mono text-2xs text-ink-2">{formatTime(t.dueTime)}</span>}
            </li>
          ))}
          {!(byDay.get(selected) ?? []).length && <li className="py-4 text-sm text-ink-3">Nothing on this day.</li>}
        </ul>
      </section>
    </div>
  );
}

function DayCell({
  date,
  today,
  inMonth,
  tasks,
  loading,
  selected,
  onSelect,
  onAdd,
  onOpen,
}: {
  date: string;
  today: string;
  inMonth: boolean;
  tasks: Task[];
  loading: boolean;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const isToday = date === today;
  const weekend = [0, 6].includes(fromISODate(date).getDay());
  const extra = tasks.length - MAX_CHIPS;
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={`${formatDue(date, today)}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        // Phones: tap selects; desktop: click empty space adds.
        if (window.matchMedia("(min-width: 640px)").matches) onAdd();
        else onSelect();
      }}
      className={cn(
        "group relative flex min-h-14 flex-col gap-1 p-1 transition-colors duration-(--dur-fast) sm:min-h-28 sm:p-1.5",
        inMonth ? (weekend ? "bg-surface" : "bg-bg") : "bg-sunken/70",
        isOver && "bg-accent-soft",
        selected && "max-sm:ring-2 max-sm:ring-ink max-sm:ring-inset",
      )}
    >
      <span
        className={cn(
          "pointer-events-none grid size-6 place-items-center self-start rounded-full font-mono text-2xs",
          isToday ? "bg-accent text-accent-ink" : inMonth ? "text-ink-2" : "text-ink-3",
        )}
      >
        {Number(date.slice(8))}
      </span>
      {/* Phone: dots */}
      <div className="pointer-events-none flex flex-wrap gap-0.5 sm:hidden">
        {tasks.slice(0, 4).map((t) => (
          <span key={t.id} className={cn("size-1.5 rounded-full", ["bg-p1", "bg-p2", "bg-p3", "bg-ink-3"][t.priority - 1])} />
        ))}
      </div>
      {/* Desktop: chips */}
      <ul className="flex flex-col gap-1 max-sm:hidden">
        {loading && inMonth && Number(date.slice(8)) % 3 === 1 && <li className="skeleton h-5" />}
        {tasks.slice(0, MAX_CHIPS).map((t) => (
          <DraggableChip key={t.id} task={t} onOpen={() => onOpen(t.id)} />
        ))}
      </ul>
      {extra > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="self-start rounded-sm px-1 font-mono text-2xs text-ink-2 hover:bg-sunken hover:text-ink max-sm:hidden">
              +{extra} more
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <p className="mb-2 px-1 font-display text-base text-ink">{formatDue(date, today)}</p>
            <ul className="flex flex-col gap-1">
              {tasks.map((t) => (
                <li key={t.id}>
                  <button className="w-full" onClick={() => onOpen(t.id)}>
                    <Chip task={t} />
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
      <button
        aria-label={`Add task on ${formatDue(date, today)}`}
        onClick={onAdd}
        className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-sm text-ink-3 opacity-0 transition-opacity duration-(--dur-fast) group-hover:opacity-100 hover:bg-sunken hover:text-ink focus-visible:opacity-100 max-sm:hidden"
      >
        <Icon icon={Plus} size="xs" />
      </button>
    </div>
  );
}

function DraggableChip({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") return onOpen();
        listeners?.onKeyDown?.(e);
      }}
      className={cn("touch-manipulation rounded-sm", isDragging && "opacity-35")}
    >
      <Chip task={task} />
    </li>
  );
}

function Chip({ task, lifted }: { task: Task; lifted?: boolean }) {
  return (
    <motion.span
      initial={lifted ? { scale: 1, rotate: 0 } : false}
      animate={lifted ? { scale: 1.04, rotate: -1.5 } : undefined}
      transition={spring.pop}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-xs",
        lifted ? "bg-raised shadow-3 ring-1 ring-line" : "bg-raised ring-1 ring-line ring-inset hover:ring-line-strong",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", ["bg-p1", "bg-p2", "bg-p3", "bg-ink-3"][task.priority - 1])} />
      {task.dueTime && <span className="shrink-0 font-mono text-2xs text-ink-3">{formatTime(task.dueTime)}</span>}
      <span className="truncate text-ink">{task.title}</span>
    </motion.span>
  );
}

"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { generateKeyBetween } from "fractional-indexing";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Burst } from "@/components/task/burst";
import { distance, duration, ease, spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { isManualOrder, useProjects, useTaskActions } from "@/lib/data";
import type { Priority, Task, View } from "@/lib/types";
import type { DateChoice } from "./reschedule";
import { TaskItem } from "./task-item";

/** How long a completed row stays (ticked, struck through) before it leaves. */
const LINGER_MS = 520;
/** Above this many rows we virtualize and skip enter/exit animation. */
const VIRTUALIZE_AT = 150;

export interface TaskGroup {
  key: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "danger";
  /** The group header already states the date, so rows show only the time. */
  hideDate?: boolean;
  tasks: Task[];
}

interface TaskListProps {
  view: View;
  groups: TaskGroup[];
  empty: React.ReactNode;
  /** Shown (with a small burst) when the user completes the last task here. */
  cleared?: React.ReactNode;
  footer?: React.ReactNode;
}

export function TaskList({ view, groups, empty, cleared, footer }: TaskListProps) {
  const { today, openTask } = useAppUI();
  const actions = useTaskActions();
  const projects = useProjects().data;
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  // Rows completed moments ago stay visible until their strike-through lands.
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const [burst, setBurst] = useState(0);
  const [justCleared, setJustCleared] = useState(false);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => !t.completedAt || lingering.has(t.id)) }))
        .filter((g) => g.tasks.length > 0),
    [groups, lingering],
  );
  const total = visibleGroups.reduce((n, g) => n + g.tasks.length, 0);
  useEffect(() => {
    if (total > 0) setJustCleared(false);
  }, [total]);

  const onToggle = useCallback(
    (t: Task) => {
      if (lingering.has(t.id) || t.completedAt) {
        clearTimeout(timers.current.get(t.id));
        setLingering((s) => new Set([...s].filter((x) => x !== t.id)));
        void actions.uncomplete(t);
        return;
      }
      setLingering((s) => new Set(s).add(t.id));
      void actions.complete(t);
      timers.current.set(
        t.id,
        setTimeout(() => {
          setLingering((s) => {
            const next = new Set(s);
            next.delete(t.id);
            return next;
          });
          // Was that the last open one here?
          const remaining = groups.flatMap((g) => g.tasks).filter((x) => x.id !== t.id && !x.completedAt);
          if (cleared && remaining.length === 0) {
            setJustCleared(true);
            setBurst((b) => b + 1);
          }
        }, LINGER_MS),
      );
    },
    [actions, cleared, groups, lingering],
  );

  const onReschedule = useCallback(
    (t: Task, c: DateChoice) => void actions.reschedule(t, c.date, c.label),
    [actions],
  );
  const onPriority = useCallback((t: Task, p: Priority) => void actions.update(t, { priority: p }), [actions]);
  const onOpen = useCallback((t: Task) => openTask(t.id), [openTask]);
  const onDelete = useCallback((t: Task) => void actions.remove(t), [actions]);

  const containerRef = useRef<HTMLDivElement>(null);

  /** Keyboard model for a focused row. Single keys, no modifiers, like the rest of the app. */
  const onRowKey = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, t: Task, move?: (dir: -1 | 1) => void) => {
      if (e.target !== e.currentTarget) return;
      const rows = [...(containerRef.current?.querySelectorAll<HTMLElement>("[data-task-row]") ?? [])];
      const i = rows.indexOf(e.currentTarget);
      const focus = (j: number) => rows[Math.max(0, Math.min(rows.length - 1, j))]?.focus();
      const k = e.key;
      if (e.altKey && (k === "ArrowUp" || k === "ArrowDown") && move) return (e.preventDefault(), move(k === "ArrowUp" ? -1 : 1));
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const handled = (() => {
        switch (k) {
          case "ArrowDown":
          case "j":
            return focus(i + 1), true;
          case "ArrowUp":
          case "k":
            return focus(i - 1), true;
          case "x":
          case " ":
            return onToggle(t), true;
          case "Enter":
          case "e":
            return onOpen(t), true;
          case "t":
            return setRescheduling(t.id), true;
          case "1":
          case "2":
          case "3":
          case "4":
            return onPriority(t, Number(k) as Priority), true;
          case "Delete":
          case "Backspace":
            focus(i + 1 < rows.length ? i + 1 : i - 1);
            return onDelete(t), true;
        }
        return false;
      })();
      if (handled) e.preventDefault();
    },
    [onDelete, onOpen, onPriority, onToggle],
  );

  if (total === 0) {
    return (
      <div className="relative">
        {justCleared && cleared ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.slow, ease: ease.enter, delay: 0.1 }}>
            {cleared}
          </motion.div>
        ) : (
          empty
        )}
        <span className="absolute top-14 left-6">
          <Burst trigger={burst} />
        </span>
        {footer}
      </div>
    );
  }

  const rowProps = (t: Task, g: TaskGroup) => ({
    task: t,
    view,
    today,
    project: t.projectId ? projectById.get(t.projectId) : undefined,
    hideDate: g.hideDate,
    done: !!t.completedAt || lingering.has(t.id),
    onToggle,
    onOpen,
    onReschedule,
    onPriority,
    onDelete,
    rescheduleOpen: rescheduling === t.id,
    onRescheduleOpenChange: (o: boolean) => setRescheduling(o ? t.id : null),
  });

  const single = visibleGroups.length === 1 && !visibleGroups[0].title;
  if (single && total > VIRTUALIZE_AT) {
    return (
      <div ref={containerRef}>
        <VirtualRows tasks={visibleGroups[0].tasks} render={(t) => rowProps(t, visibleGroups[0])} onRowKey={onRowKey} />
        {footer}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-8">
      {visibleGroups.map((g) => (
        <section key={g.key} aria-label={typeof g.title === "string" ? g.title : undefined}>
          {g.title && (
            <header className="sticky top-14 z-10 -mx-2 flex items-baseline gap-3 border-b border-line bg-bg/95 px-2 pt-2 pb-2 md:top-0">
              <h2 className={cn("font-display text-lg", g.tone === "danger" ? "text-danger" : "text-ink")}>{g.title}</h2>
              {g.sub && <span className="font-mono text-2xs text-ink-3">{g.sub}</span>}
              {g.action && <div className="ml-auto">{g.action}</div>}
            </header>
          )}
          {isManualOrder(view) ? (
            <ManualRows tasks={g.tasks} render={(t) => rowProps(t, g)} onRowKey={onRowKey} onMove={actions.update} />
          ) : (
            <ul className="pl-0">
              <AnimatePresence initial={false} mode="popLayout">
                {g.tasks.map((t) => (
                  <motion.li
                    key={t.id}
                    layout="position"
                    data-task-row
                    tabIndex={0}
                    onKeyDown={(e) => onRowKey(e, t)}
                    className="group/row outline-offset-[-2px]"
                    {...rowMotion}
                  >
                    <TaskItem {...rowProps(t, g)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      ))}
      {footer}
    </div>
  );
}

const rowMotion = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.98, transition: { duration: duration.base, ease: ease.exit } },
  transition: { ...spring.pop, layout: spring.layout },
};

type RenderProps = (t: Task) => React.ComponentProps<typeof TaskItem>;
type RowKey = (e: React.KeyboardEvent<HTMLElement>, t: Task, move?: (dir: -1 | 1) => void) => void;

/** Inbox and projects: drag (by the grip) or Alt+↑/↓ to reorder. One row written per move. */
function ManualRows({
  tasks,
  render,
  onRowKey,
  onMove,
}: {
  tasks: Task[];
  render: RenderProps;
  onRowKey: RowKey;
  onMove: (t: Task, patch: { sortKey: string }) => unknown;
}) {
  const [order, setOrder] = useState(tasks);
  const orderRef = useRef(order);
  orderRef.current = order;
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setOrder(tasks);
  }, [tasks]);

  const persist = (list: Task[], t: Task) => {
    const i = list.findIndex((x) => x.id === t.id);
    const prev = list[i - 1]?.sortKey ?? null;
    const next = list[i + 1]?.sortKey ?? null;
    if (prev === "￿" || next === "￿") return; // a row still being created; skip this move
    try {
      const sortKey = generateKeyBetween(prev, next);
      if (sortKey !== t.sortKey) onMove(t, { sortKey });
    } catch {
      /* keys out of order mid-sync; the next refetch settles it */
    }
  };

  const moveBy = (t: Task, dir: -1 | 1) => {
    const i = order.findIndex((x) => x.id === t.id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    persist(next, t);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task-id="${t.id}"]`)?.focus());
  };

  return (
    <Reorder.Group as="ul" axis="y" values={order} onReorder={setOrder} className="pl-0">
      <AnimatePresence initial={false} mode="popLayout">
        {order.map((t) => (
          <ManualRow
            key={t.id}
            task={t}
            render={render}
            onKey={(e) => onRowKey(e, t, (d) => moveBy(t, d))}
            onDragStart={() => (dragging.current = true)}
            onDragEnd={() => {
              dragging.current = false;
              persist(orderRef.current, t);
            }}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}

function ManualRow({
  task,
  render,
  onKey,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  render: RenderProps;
  onKey: (e: React.KeyboardEvent<HTMLElement>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-task-row
      data-task-id={task.id}
      tabIndex={0}
      onKeyDown={onKey}
      className="group/row relative bg-bg outline-offset-[-2px]"
      whileDrag={{ scale: distance.lift, rotate: -distance.liftTilt, boxShadow: "var(--sh-3)", zIndex: 5, borderRadius: 8 }}
      {...rowMotion}
    >
      <TaskItem {...render(task)} dragControls={controls} />
    </Reorder.Item>
  );
}

/** 150+ rows: only what's on screen is in the DOM. */
function VirtualRows({ tasks, render, onRowKey }: { tasks: Task[]; render: RenderProps; onRowKey: RowKey }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(listRef.current?.offsetTop ?? 0), []);
  const v = useWindowVirtualizer({ count: tasks.length, estimateSize: () => 64, overscan: 8, scrollMargin: offset });
  return (
    <ul ref={listRef} className="relative pl-0" style={{ height: v.getTotalSize() }}>
      {v.getVirtualItems().map((row) => {
        const t = tasks[row.index];
        return (
          <li
            key={t.id}
            data-index={row.index}
            ref={v.measureElement}
            data-task-row
            tabIndex={0}
            onKeyDown={(e) => onRowKey(e, t)}
            className="group/row absolute inset-x-0 top-0 outline-offset-[-2px]"
            style={{ transform: `translateY(${row.start - v.options.scrollMargin}px)` }}
          >
            <TaskItem {...render(t)} />
          </li>
        );
      })}
    </ul>
  );
}


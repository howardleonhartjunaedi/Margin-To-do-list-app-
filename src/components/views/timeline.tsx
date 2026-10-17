"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { useProjects, useTaskActions, useTasks } from "@/lib/data";
import { addDays, daysBetween, formatDue, fromISODate } from "@/lib/dates";
import { applyFilter, type Filter } from "@/lib/filters";
import { projectDot } from "@/lib/project-colors";
import type { Task, View } from "@/lib/types";
import { useUrlParam } from "@/lib/view-transition";

const DAYS = 35;
const ROW = 36;
const BAR_TONE = ["bg-danger-soft ring-p1", "bg-warning-soft ring-p2", "bg-sunken ring-p3", "bg-sunken ring-line-strong"];

const mondayOf = (d: string) => addDays(d, -((fromISODate(d).getDay() + 6) % 7));

type DragMode = "move" | "start" | "end";

/**
 * Timeline: each dated task is a bar from its start to its due date.
 * Drag the bar to move it, drag an edge to change start or due. Keyboard: focus a bar,
 * ←/→ moves it a day, Shift+←/→ changes the due date, Enter opens it.
 */
export function TimelineLayout({ projectId, filter }: { projectId?: string; filter: Filter }) {
  const { today, openTask } = useAppUI();
  const actions = useTaskActions();
  const projects = useProjects().data ?? [];
  const [from, setFrom] = useUrlParam("from", addDays(mondayOf(today), -7));
  const to = addDays(from, DAYS - 1);
  const view = useMemo<View>(() => ({ kind: "range", from, to, projectId }), [from, to, projectId]);
  const q = useTasks(view);
  const tasks = useMemo(() => applyFilter(q.data ?? [], filter, today), [q.data, filter, today]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);

  // Column width follows the container so five weeks fit on a laptop and scroll on a phone.
  const scroller = useRef<HTMLDivElement>(null);
  const [col, setCol] = useState(32);
  const [labelW, setLabelW] = useState(0); // a title column only when there's room for it
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const label = el.clientWidth > 640 ? 200 : 0;
      setLabelW(label);
      setCol(Math.max(28, Math.floor((el.clientWidth - label) / DAYS)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const groups = useMemo(() => {
    const g = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = t.projectId ?? "inbox";
      g.set(k, [...(g.get(k) ?? []), t]);
    }
    const order = ["inbox", ...projects.map((p) => p.id)];
    return [...g.entries()].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  }, [tasks, projects]);

  const commit = (t: Task, start: string, due: string) => {
    if (start === (t.startDate ?? t.dueDate) && due === t.dueDate) return;
    void actions.update(
      t,
      { dueDate: due, startDate: start === due ? null : start },
      { message: start === due ? `Due ${formatDue(due, today)}.` : `${formatDue(start, today)} → ${formatDue(due, today)}.`, undo: { startDate: t.startDate, dueDate: t.dueDate, dueTime: t.dueTime } },
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 font-mono text-xs text-ink-2">
          {formatDue(from, today)} – {formatDue(to, today)}
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setFrom(addDays(mondayOf(today), -7))}>
          Today
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Two weeks earlier" onClick={() => setFrom(addDays(from, -14))}>
          <Icon icon={ChevronLeft} />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Two weeks later" onClick={() => setFrom(addDays(from, 14))}>
          <Icon icon={ChevronRight} />
        </Button>
      </div>
      {q.isError && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}

      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-lenis-prevent data-cursor="native">
        <div className="relative" style={{ width: labelW + col * DAYS }}>
          {/* Day header */}
          <div className="sticky top-0 z-10 flex border-b border-line bg-bg" style={{ paddingLeft: labelW }}>
            {days.map((d) => {
              const dt = fromISODate(d);
              return (
                <div
                  key={d}
                  className={cn("shrink-0 py-1 text-center font-mono text-2xs", d === today ? "text-accent" : "text-ink-3")}
                  style={{ width: col }}
                >
                  {dt.getDate() === 1 || d === from ? <span className="block text-ink-2">{dt.toLocaleString("en-GB", { month: "short" })}</span> : <span className="block">&nbsp;</span>}
                  <span>{"SMTWTFS"[dt.getDay()]}</span>
                  <span className="block">{dt.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Weekend shading + today line */}
          <div aria-hidden className="pointer-events-none absolute inset-0 top-14" style={{ left: labelW }}>
            {days.map((d, i) =>
              [0, 6].includes(fromISODate(d).getDay()) ? (
                <div key={d} className="absolute inset-y-0 bg-sunken/50" style={{ left: i * col, width: col }} />
              ) : null,
            )}
            {today >= from && today <= to && (
              <div className="absolute inset-y-0 w-px bg-accent" style={{ left: daysBetween(from, today) * col + col / 2 }} />
            )}
          </div>

          {q.isPending ? (
            <div className="flex flex-col gap-3 py-4" style={{ paddingLeft: labelW }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="relative px-1">
              <EmptyState mark="→" title="Nothing dated in these five weeks." body="Give tasks a due date — and a start date for longer work — to see them here." />
            </div>
          ) : (
            groups.map(([pid, list]) => {
              const p = projects.find((x) => x.id === pid);
              return (
                <section key={pid} className="relative">
                  <h3 className="sticky left-0 flex h-8 items-end gap-2 px-1 pb-1 text-xs font-medium text-ink-2" style={{ width: "max-content" }}>
                    <span className={cn("size-2 rounded-full", p ? projectDot(p.color) : "bg-ink-3")} />
                    {p?.name ?? "Inbox"}
                  </h3>
                  {list.map((t) => (
                    <div key={t.id} className="relative flex items-center border-b border-line/60" style={{ height: ROW }}>
                      {labelW > 0 && (
                        <button
                          onClick={() => openTask(t.id)}
                          className="sticky left-0 z-[1] h-full shrink-0 truncate bg-bg pr-3 text-left text-sm text-ink hover:underline"
                          style={{ width: labelW }}
                        >
                          {t.title}
                        </button>
                      )}
                      <Bar task={t} from={from} col={col} offset={labelW} showTitle={labelW === 0} onCommit={commit} onOpen={() => openTask(t.id)} />
                    </div>
                  ))}
                </section>
              );
            })
          )}
        </div>
      </div>
      {!q.isPending && (
        <p className="mt-3 text-xs text-ink-3">Tasks without a due date don’t appear on the timeline.</p>
      )}
    </div>
  );
}

function Bar({
  task,
  from,
  col,
  offset,
  showTitle,
  onCommit,
  onOpen,
}: {
  task: Task;
  from: string;
  col: number;
  offset: number;
  showTitle: boolean;
  onCommit: (t: Task, start: string, due: string) => void;
  onOpen: () => void;
}) {
  const start = task.startDate ?? task.dueDate!;
  const due = task.dueDate!;
  const [drag, setDrag] = useState<{ mode: DragMode; x0: number; d: number } | null>(null);

  // Live preview while dragging (snapped to whole days)
  let s = start;
  let e = due;
  if (drag) {
    if (drag.mode === "move") (s = addDays(start, drag.d)), (e = addDays(due, drag.d));
    if (drag.mode === "start") s = addDays(start, Math.min(drag.d, daysBetween(start, due)));
    if (drag.mode === "end") e = addDays(due, Math.max(drag.d, -daysBetween(start, due)));
  }
  const left = offset + daysBetween(from, s) * col;
  const width = (daysBetween(s, e) + 1) * col;
  // Edge handles only where there's room; a short bar is all "move".
  const resizable = width >= col * 2;

  const begin = (mode: DragMode) => (ev: React.PointerEvent) => {
    ev.stopPropagation();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    setDrag({ mode, x0: ev.clientX, d: 0 });
  };
  const move = (ev: React.PointerEvent) => drag && setDrag({ ...drag, d: Math.round((ev.clientX - drag.x0) / col) });
  const end = () => {
    if (!drag) return;
    const moved = drag.d !== 0;
    setDrag(null);
    if (moved) onCommit(task, s, e);
    else if (drag.mode === "move") onOpen();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${task.title}: ${s === e ? e : `${s} to ${e}`}. Arrow keys move, Shift+arrows change the due date.`}
      onPointerDown={begin("move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={(ev) => {
        const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
        if (ev.key === "Enter") return onOpen();
        if (!step) return;
        ev.preventDefault();
        if (ev.shiftKey) {
          const ne = addDays(due, step);
          if (ne >= start) onCommit(task, start, ne);
        } else onCommit(task, addDays(start, step), addDays(due, step));
      }}
      data-cursor="drag"
      className={cn(
        "group absolute top-1.5 flex h-6 touch-none items-center rounded-sm text-xs ring-1 ring-inset select-none",
        BAR_TONE[task.priority - 1],
        drag && "z-10 shadow-2",
      )}
      style={{ left, width: Math.max(width, col) }}
    >
      {resizable && (
        <span
          onPointerDown={begin("start")}
          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-sm opacity-0 group-hover:bg-ink/15 group-hover:opacity-100"
          aria-hidden
        />
      )}
      {showTitle && <span className="truncate px-2 text-ink">{task.title}</span>}
      {resizable ? (
        <span
          onPointerDown={begin("end")}
          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-sm opacity-0 group-hover:bg-ink/15 group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

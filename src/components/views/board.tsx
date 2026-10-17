"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { useProjects, useTaskActions } from "@/lib/data";
import { projectDot } from "@/lib/project-colors";
import type { Priority, Project, Task } from "@/lib/types";
import type { UpdateTaskInput } from "@/lib/validation";
import { useUrlParam } from "@/lib/view-transition";
import { BoardCard } from "./board-card";

export type GroupBy = "priority" | "project";

interface Column {
  id: string;
  title: string;
  dot?: string;
  has: (t: Task) => boolean;
  patch: UpdateTaskInput;
  /** Column defaults for "+" quick add */
  defaults: { priority?: Priority; projectId?: string | null };
}

const PRIORITY_NAMES = ["Urgent", "High", "Normal", "Someday"];

function columnsFor(groupBy: GroupBy, projects: Project[]): Column[] {
  if (groupBy === "priority")
    return ([1, 2, 3, 4] as Priority[]).map((p) => ({
      id: `p${p}`,
      title: `P${p} · ${PRIORITY_NAMES[p - 1]}`,
      dot: ["bg-p1", "bg-p2", "bg-p3", "bg-p4"][p - 1],
      has: (t) => t.priority === p,
      patch: { priority: p },
      defaults: { priority: p },
    }));
  return [
    { id: "inbox", title: "Inbox", has: (t) => !t.projectId, patch: { projectId: null }, defaults: { projectId: null } },
    ...projects.map((p) => ({
      id: p.id,
      title: p.name,
      dot: projectDot(p.color),
      has: (t: Task) => t.projectId === p.id,
      patch: { projectId: p.id },
      defaults: { projectId: p.id },
    })),
  ];
}

const bySortKey = (a: Task, b: Task) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);

/**
 * Kanban. Columns are a field (priority or project); dropping a card in a column
 * sets that field, and its position sets the order. Pointer: drag anywhere on the card.
 * Keyboard: focus a card, Space to lift, arrows to move, Space to drop, Esc to cancel.
 */
export function Board({ tasks, allowProjectGroup, fixed }: { tasks: Task[]; allowProjectGroup: boolean; fixed?: { projectId?: string | null } }) {
  const { today, openTask, openQuickAdd } = useAppUI();
  const projects = useProjects().data ?? [];
  const actions = useTaskActions();
  const [groupRaw, setGroup] = useUrlParam("group", "priority");
  const groupBy: GroupBy = allowProjectGroup && groupRaw === "project" ? "project" : "priority";
  const columns = useMemo(() => columnsFor(groupBy, projects), [groupBy, projects]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const derive = () =>
    Object.fromEntries(columns.map((c) => [c.id, tasks.filter(c.has).sort(bySortKey).map((t) => t.id)])) as Record<string, string[]>;
  const [items, setItems] = useState(derive);
  const [active, setActive] = useState<string | null>(null);
  const dragging = useRef(false);
  const origin = useRef<string | null>(null);
  useEffect(() => {
    if (!dragging.current) setItems(derive());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, columns]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press and hold, so a swipe still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] }, // Enter stays "open"
    }),
  );

  const columnOf = (id: string) => (id in items ? id : Object.keys(items).find((c) => items[c].includes(id)));

  const onDragStart = (e: DragStartEvent) => {
    dragging.current = true;
    setActive(String(e.active.id));
    origin.current = columnOf(String(e.active.id)) ?? null;
  };

  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (!over) return;
    const from = columnOf(String(a.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;
    setItems((cur) => {
      const target = cur[to];
      const overIndex = target.indexOf(String(over.id));
      const index = overIndex === -1 ? target.length : overIndex;
      return {
        ...cur,
        [from]: cur[from].filter((x) => x !== a.id),
        [to]: [...target.slice(0, index), String(a.id), ...target.slice(index)],
      };
    });
  };

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    dragging.current = false;
    setActive(null);
    const id = String(a.id);
    const task = byId.get(id);
    const col = columnOf(id);
    if (!task || !col || !over) return setItems(derive());

    let list = items[col];
    const overIndex = list.indexOf(String(over.id));
    const from = list.indexOf(id);
    if (overIndex !== -1 && overIndex !== from) {
      list = [...list];
      list.splice(from, 1);
      list.splice(overIndex, 0, id);
      setItems((cur) => ({ ...cur, [col]: list }));
    }
    const i = list.indexOf(id);
    const key = (x?: string) => (x ? (byId.get(x)?.sortKey ?? null) : null);
    let sortKey: string | undefined;
    try {
      sortKey = generateKeyBetween(key(list[i - 1]), key(list[i + 1]));
    } catch {
      sortKey = undefined; // neighbours mid-sync; keep the old order key
    }
    const column = columns.find((c) => c.id === col)!;
    const moved = col !== origin.current;
    const patch: UpdateTaskInput = { ...(moved ? column.patch : {}), ...(sortKey && sortKey !== task.sortKey ? { sortKey } : {}) };
    if (!Object.keys(patch).length) return;
    const undo: UpdateTaskInput = moved
      ? { ...(groupBy === "priority" ? { priority: task.priority } : { projectId: task.projectId }), sortKey: task.sortKey }
      : { sortKey: task.sortKey };
    void actions.update(task, patch, moved ? { message: `Moved to ${column.title.split(" · ")[0]}.`, undo } : {});
  };

  const activeTask = active ? byId.get(active) : undefined;

  return (
    <div>
      {allowProjectGroup && (
        <div className="mb-4 flex items-center gap-3 text-xs text-ink-2">
          Group by
          <Segmented<GroupBy>
            label="Group board by"
            size="sm"
            value={groupBy}
            onValueChange={(g) => setGroup(g, { transition: true })}
            options={[
              { value: "priority", label: "Priority" },
              { value: "project", label: "Project" },
            ]}
          />
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          dragging.current = false;
          setActive(null);
          setItems(derive());
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable: "To move a task, press Space. Use the arrow keys to move it between columns, Space to drop, or Escape to cancel.",
          },
        }}
      >
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8"
          data-lenis-prevent
          role="region"
          aria-label="Board"
        >
          {columns.map((c) => (
            <BoardColumn
              key={c.id}
              column={c}
              ids={items[c.id] ?? []}
              onAdd={() => openQuickAdd({ ...fixed, ...c.defaults, dueDate: null })}
            >
              {(items[c.id] ?? []).map((id) => {
                const t = byId.get(id);
                if (!t) return null;
                return (
                  <SortableCard key={id} id={id} onOpen={() => openTask(id)}>
                    <BoardCard
                      task={t}
                      today={today}
                      showPriority={groupBy !== "priority"}
                      project={groupBy === "project" || !t.projectId || fixed?.projectId ? undefined : projectById.get(t.projectId)}
                      onOpen={() => openTask(id)}
                      onComplete={() => void actions.complete(t)}
                    />
                  </SortableCard>
                );
              })}
            </BoardColumn>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {activeTask && (
            <BoardCard
              task={activeTask}
              today={today}
              lifted
              showPriority={groupBy !== "priority"}
              project={activeTask.projectId && groupBy !== "project" && !fixed?.projectId ? projectById.get(activeTask.projectId) : undefined}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardColumn({ column, ids, onAdd, children }: { column: Column; ids: string[]; onAdd: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section aria-label={column.title} className="flex w-[min(288px,82vw)] shrink-0 snap-start flex-col">
      <header className="mb-2 flex items-center gap-2 px-1">
        {column.dot && <span className={cn("size-2 rounded-full", column.dot)} />}
        <h3 className="truncate text-sm font-medium text-ink">{column.title}</h3>
        <span className="font-mono text-2xs text-ink-3">{ids.length}</span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Add task to ${column.title}`} onClick={onAdd}>
          <Icon icon={Plus} size="xs" />
        </Button>
      </header>
      <SortableContext id={column.id} items={ids} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-md p-1.5 transition-colors duration-(--dur-fast)",
            isOver ? "bg-accent-soft/60" : "bg-sunken/60",
          )}
        >
          {children}
          {ids.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink-3">Drop a task here</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ id, onOpen, children }: { id: string; onOpen: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) return onOpen();
        listeners?.onKeyDown?.(e);
      }}
      data-cursor="drag"
      className={cn("touch-manipulation rounded-md outline-offset-2", isDragging && "opacity-35")}
    >
      {children}
    </li>
  );
}

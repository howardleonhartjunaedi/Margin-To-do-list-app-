"use client";

import { Plus, Repeat, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useAppUI } from "@/components/app/app-ui";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useProjects, useTaskActions, useTaskDetail } from "@/lib/data";
import { formatDue } from "@/lib/dates";
import { describeRRule } from "@/lib/quick-add/rrule";
import type { Priority, Task } from "@/lib/types";
import { DateMenu } from "./reschedule";
import { RemindersSection } from "./reminders-section";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const REPEAT_OPTIONS = [
  "FREQ=DAILY",
  "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  "FREQ=WEEKLY",
  "FREQ=WEEKLY;INTERVAL=2",
  "FREQ=MONTHLY",
  "FREQ=YEARLY",
];

export function TaskDetailSheet() {
  const { openTaskId, closeTask } = useAppUI();
  // Keep the last id while the sheet animates out.
  const [shownId, setShownId] = useState(openTaskId);
  useEffect(() => {
    if (openTaskId) setShownId(openTaskId);
  }, [openTaskId]);

  return (
    <Sheet open={!!openTaskId} onOpenChange={(o) => !o && closeTask()} title="Task details">
      {shownId && <TaskDetail id={shownId} />}
    </Sheet>
  );
}

function TaskDetail({ id }: { id: string }) {
  const { today, closeTask } = useAppUI();
  const q = useTaskDetail(id);
  const projects = useProjects().data ?? [];
  const actions = useTaskActions();

  if (q.isPending) {
    return (
      <div className="flex flex-col gap-4 p-6" role="status" aria-label="Loading task">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <SheetClose className="-ml-2" />
        <p className="font-display text-xl">That task doesn’t exist any more.</p>
        <p className="text-sm text-ink-2">It may have been deleted on another device.</p>
      </div>
    );
  }

  const { task, subtasks, reminders } = q.data;
  const project = projects.find((p) => p.id === task.projectId);
  const done = !!task.completedAt;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <SheetClose className="-ml-2" />
        <span className="truncate text-sm text-ink-2">{project?.name ?? "Inbox"}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-danger hover:bg-danger-soft hover:text-danger"
          onClick={() => {
            closeTask();
            void actions.remove(task);
          }}
        >
          <Icon icon={Trash2} /> Delete
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-10 sm:px-6" data-lenis-prevent>
        <div className="flex items-start gap-3">
          <div className="pt-1.5">
            <TaskCheckbox
              checked={done}
              priority={task.priority}
              onCheckedChange={() => void (done ? actions.uncomplete(task) : actions.complete(task))}
              aria-label={done ? "Mark not done" : "Complete task"}
            />
          </div>
          <EditableTitle key={task.id} task={task} onSave={(title) => actions.update(task, { title })} />
        </div>

        <dl className="mt-6 grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-3 text-sm">
          <dt className="text-ink-2">Date</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" className={cn(task.dueDate && task.dueDate < today && "text-danger")}>
                  {task.dueDate ? formatDue(task.dueDate, today) : "No date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1.5">
                <DateMenu today={today} value={task.dueDate} onPick={(c) => void actions.update(task, { dueDate: c.date })} />
              </PopoverContent>
            </Popover>
            {task.dueDate && (
              <input
                type="time"
                aria-label="Time"
                data-cursor="native"
                defaultValue={task.dueTime ?? ""}
                key={`${task.id}-${task.dueTime}`}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  if (v !== task.dueTime) void actions.update(task, { dueTime: v });
                }}
                className="h-8 rounded-md bg-raised px-2 font-mono text-xs text-ink ring-1 ring-control ring-inset"
              />
            )}
          </dd>

          <dt className="text-ink-2">Priority</dt>
          <dd>
            <Segmented<"1" | "2" | "3" | "4">
              label="Priority"
              size="sm"
              value={String(task.priority) as "1"}
              onValueChange={(v) => void actions.update(task, { priority: Number(v) as Priority })}
              options={(["1", "2", "3", "4"] as const).map((p) => ({ value: p, label: `P${p}`, title: ["Urgent", "High", "Normal", "Someday"][Number(p) - 1] }))}
            />
          </dd>

          <dt className="text-ink-2">
            <label htmlFor="task-project">Project</label>
          </dt>
          <dd>
            <select
              id="task-project"
              value={task.projectId ?? ""}
              onChange={(e) => void actions.update(task, { projectId: e.target.value || null })}
              className="h-8 max-w-full rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset"
            >
              <option value="">Inbox</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </dd>

          <dt className="text-ink-2">
            <label htmlFor="task-labels">Labels</label>
          </dt>
          <dd>
            <input
              id="task-labels"
              key={`${task.id}-${task.labels.join()}`}
              defaultValue={task.labels.join(", ")}
              placeholder="errands, calls"
              onBlur={(e) => {
                const labels = e.target.value
                  .split(",")
                  .map((s) => s.trim().replace(/^@/, ""))
                  .filter(Boolean);
                if (labels.join() !== task.labels.join()) void actions.update(task, { labels });
              }}
              className="h-8 w-full rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset placeholder:text-ink-3"
            />
          </dd>

          <dt className="text-ink-2">
            <label htmlFor="task-repeat">Repeats</label>
          </dt>
          <dd className="flex items-center gap-2">
            <select
              id="task-repeat"
              value={task.recurrence ?? ""}
              onChange={(e) => {
                const recurrence = e.target.value || null;
                // A repeating task needs a start date; default to today.
                void actions.update(task, { recurrence, ...(recurrence && !task.dueDate ? { dueDate: today } : {}) });
              }}
              className="h-8 max-w-full rounded-md bg-raised px-2 text-sm text-ink ring-1 ring-control ring-inset"
            >
              <option value="">Doesn’t repeat</option>
              {REPEAT_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {describeRRule(r)}
                </option>
              ))}
              {task.recurrence && !REPEAT_OPTIONS.includes(task.recurrence) && <option value={task.recurrence}>{describeRRule(task.recurrence)}</option>}
            </select>
            {task.recurrence && <Icon icon={Repeat} size="xs" className="text-ink-3" />}
          </dd>
        </dl>

        <RemindersSection task={task} reminders={reminders} />
        <Notes key={task.id} task={task} onSave={(notes) => actions.update(task, { notes })} />
        <Subtasks parent={task} subtasks={subtasks} />

        <p className="mt-10 font-mono text-2xs text-ink-3">
          Created {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

function EditableTitle({ task, onSave }: { task: Task; onSave: (t: string) => unknown }) {
  const [value, setValue] = useState(task.title);
  const commit = () => {
    const v = value.trim();
    if (!v) return setValue(task.title); // never save an empty title
    if (v !== task.title) onSave(v);
  };
  return (
    <textarea
      aria-label="Title"
      value={value}
      rows={1}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, " "))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-full resize-none bg-transparent font-display text-2xl leading-8 text-ink outline-none [field-sizing:content]",
        "focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus",
        task.completedAt && "text-ink-3 line-through decoration-1",
      )}
    />
  );
}

function Notes({ task, onSave }: { task: Task; onSave: (n: string) => unknown }) {
  const [value, setValue] = useState(task.notes);
  return (
    <div className="mt-8">
      <label htmlFor="task-notes" className="font-mono text-2xs tracking-wider text-ink-3 uppercase">
        Notes
      </label>
      <textarea
        id="task-notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== task.notes && onSave(value)}
        placeholder="Links, details, the address…"
        className="mt-2 min-h-24 w-full resize-y rounded-md bg-surface px-3 py-2 text-sm leading-6 text-ink ring-1 ring-line ring-inset outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-focus [field-sizing:content]"
      />
    </div>
  );
}

function Subtasks({ parent, subtasks }: { parent: Task; subtasks: Task[] }) {
  const actions = useTaskActions();
  const [text, setText] = useState("");
  const done = subtasks.filter((s) => s.completedAt).length;

  return (
    <section className="mt-8" aria-labelledby="subtasks-h">
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <h3 id="subtasks-h" className="font-mono text-2xs tracking-wider text-ink-3 uppercase">
          Subtasks
        </h3>
        {subtasks.length > 0 && (
          <span className="font-mono text-2xs text-ink-3">
            {done}/{subtasks.length}
          </span>
        )}
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {subtasks.map((s) => (
            <motion.li
              key={s.id}
              layout="position"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.pop}
              className="group flex items-center gap-3 border-b border-line py-2.5"
            >
              <TaskCheckbox
                checked={!!s.completedAt}
                priority={4}
                className="size-4"
                onCheckedChange={() => void actions.update(s, { completed: !s.completedAt })}
                aria-label={`${s.completedAt ? "Mark not done" : "Complete"}: ${s.title}`}
              />
              <span className={cn("min-w-0 flex-1 text-sm", s.completedAt ? "text-ink-3 line-through" : "text-ink")}>{s.title}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete subtask ${s.title}`}
                className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                onClick={() => void actions.remove(s)}
              >
                <Icon icon={X} size="xs" />
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form
        className="flex items-center gap-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = text.trim();
          if (!title) return;
          setText("");
          void actions.create({ id: crypto.randomUUID(), title, parentId: parent.id, projectId: parent.projectId });
        }}
      >
        <Icon icon={Plus} size="xs" className="ml-0.5 text-ink-3" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a subtask"
          aria-label="Add a subtask"
          className="h-8 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </form>
    </section>
  );
}

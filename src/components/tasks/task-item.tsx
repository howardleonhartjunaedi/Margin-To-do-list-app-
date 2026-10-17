"use client";

import { AlignLeft, CalendarClock, Check, Flag, GripVertical, ListChecks, MoreHorizontal, PanelRightOpen, Repeat, Trash2 } from "lucide-react";
import { motion, type DragControls } from "motion/react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { PriorityFlag } from "@/components/ui/priority";
import { Tooltip } from "@/components/ui/tooltip";
import { duration, ease } from "@/design/motion";
import { cn } from "@/lib/cn";
import { formatDue, formatTime } from "@/lib/dates";
import { projectDot } from "@/lib/project-colors";
import type { Priority, Project, Task, View } from "@/lib/types";
import { ReschedulePopover, type DateChoice } from "./reschedule";

const PRIORITY_TEXT: Record<Priority, string> = { 1: "text-p1", 2: "text-p2", 3: "text-p3", 4: "text-p4" };

export interface TaskItemProps {
  task: Task;
  view: View;
  today: string;
  project?: Pick<Project, "name" | "color">;
  /** Group header already says the date (Upcoming day groups, Today's "Today" section). */
  hideDate?: boolean;
  done: boolean;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onReschedule: (t: Task, c: DateChoice) => void;
  onPriority: (t: Task, p: Priority) => void;
  onDelete: (t: Task) => void;
  rescheduleOpen: boolean;
  onRescheduleOpenChange: (open: boolean) => void;
  dragControls?: DragControls;
}

export const TaskItem = memo(function TaskItem({
  task,
  view,
  today,
  project,
  hideDate,
  done,
  onToggle,
  onOpen,
  onReschedule,
  onPriority,
  onDelete,
  rescheduleOpen,
  onRescheduleOpenChange,
  dragControls,
}: TaskItemProps) {
  const overdue = !!task.dueDate && task.dueDate < today;
  const showDate = !!task.dueDate && !(hideDate && !overdue);
  const dueText = showDate ? formatDue(task.dueDate!, today, task.dueTime) : task.dueTime ? formatTime(task.dueTime) : null;

  return (
    <div className="group relative flex items-start gap-3 border-b border-line py-3 pr-1 pl-2 transition-colors duration-(--dur-fast) group-focus-visible/row:bg-surface hover:bg-surface">
      {dragControls && (
        <span
          data-cursor="drag"
          data-cursor-label="Drag"
          aria-hidden
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
          className="absolute top-3.5 -left-6 hidden touch-none text-ink-3 opacity-0 transition-opacity duration-(--dur-fast) group-hover:opacity-100 sm:block"
        >
          <Icon icon={GripVertical} />
        </span>
      )}

      <div className="pt-0.5">
        <TaskCheckbox
          checked={done}
          priority={task.priority}
          onCheckedChange={() => onToggle(task)}
          aria-label={`${done ? "Mark not done" : "Complete"}: ${task.title}`}
          tabIndex={-1}
        />
      </div>

      <div className="min-w-0 flex-1 cursor-default" onClick={() => onOpen(task)} data-cursor="pointer">
        <p className={cn("relative w-fit max-w-full text-base leading-6 break-words sm:text-sm sm:leading-6", done ? "text-ink-3" : "text-ink")}>
          {task.title}
          <motion.span
            aria-hidden
            className="absolute top-3 left-0 h-px w-full origin-left bg-ink-3"
            initial={false}
            animate={{ scaleX: done ? 1 : 0 }}
            transition={{ duration: duration.base, ease: ease.enter, delay: done ? 0.08 : 0 }}
          />
        </p>
        <Meta task={task} view={view} project={project} dueText={dueText} overdue={overdue} />
      </div>

      <div
        className={cn(
          "flex gap-0.5 transition-opacity duration-(--dur-fast)",
          rescheduleOpen ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100",
        )}
      >
        <ReschedulePopover
          today={today}
          value={task.dueDate}
          open={rescheduleOpen}
          onOpenChange={onRescheduleOpenChange}
          onPick={(c) => onReschedule(task, c)}
        >
          <span className="max-sm:hidden">
            <Tooltip content="Reschedule" shortcut={["T"]}>
              <Button variant="ghost" size="icon-sm" aria-label="Reschedule" tabIndex={-1}>
                <Icon icon={CalendarClock} />
              </Button>
            </Tooltip>
          </span>
        </ReschedulePopover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions" tabIndex={-1}>
              <Icon icon={MoreHorizontal} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem icon={<Icon icon={PanelRightOpen} />} shortcut="↵" onSelect={() => onOpen(task)}>
              Open
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Icon icon={CalendarClock} />} shortcut="T" onSelect={() => setTimeout(() => onRescheduleOpenChange(true), 0)}>
              Reschedule…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            {([1, 2, 3, 4] as Priority[]).map((p) => (
              <DropdownMenuItem
                key={p}
                icon={<Icon icon={Flag} className={PRIORITY_TEXT[p]} fill={p < 4 ? "currentColor" : "none"} />}
                shortcut={String(p)}
                onSelect={() => onPriority(task, p)}
              >
                <span className="inline-flex items-center gap-2">
                  {["Urgent", "High", "Normal", "Someday"][p - 1]}
                  {task.priority === p && <Icon icon={Check} size="xs" className="text-ink-3" label="current" />}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" icon={<Icon icon={Trash2} />} shortcut="⌫" onSelect={() => onDelete(task)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

function Meta({
  task,
  view,
  project,
  dueText,
  overdue,
}: {
  task: Task;
  view: View;
  project?: Pick<Project, "name" | "color">;
  dueText: string | null;
  overdue: boolean;
}) {
  const showProject = view.kind !== "project" && project;
  const items = [
    dueText && (
      <span key="due" className={cn("inline-flex items-center gap-1 font-mono text-2xs", overdue ? "text-danger" : "text-ink-2")}>
        {dueText}
        {task.recurrence && <Icon icon={Repeat} size="xs" label="Repeats" />}
      </span>
    ),
    !dueText && task.recurrence && <Icon key="rep" icon={Repeat} size="xs" label="Repeats" className="text-ink-3" />,
    task.priority < 4 && <PriorityFlag key="pri" priority={task.priority} />,
    task.subtaskCount > 0 && (
      <span key="sub" className="inline-flex items-center gap-1 font-mono text-2xs text-ink-2">
        <Icon icon={ListChecks} size="xs" />
        {task.subtaskDone}/{task.subtaskCount}
        <span className="sr-only"> subtasks done</span>
      </span>
    ),
    task.notes && <Icon key="notes" icon={AlignLeft} size="xs" label="Has notes" className="text-ink-3" />,
    ...task.labels.map((l) => (
      <span key={`l-${l}`} className="text-xs text-ink-3">
        @{l}
      </span>
    )),
    showProject && (
      <span key="proj" className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-2">
        <span className={cn("size-2 rounded-full", projectDot(project.color))} />
        {project.name}
      </span>
    ),
  ].filter(Boolean);
  if (!items.length) return null;
  return <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">{items}</div>;
}

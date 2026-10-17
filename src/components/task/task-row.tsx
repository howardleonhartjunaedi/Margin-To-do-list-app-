"use client";

import { CalendarClock, GripVertical, MoreHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { duration, ease, spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { Dot } from "../ui/badge";
import { Button } from "../ui/button";
import { TaskCheckbox } from "../ui/checkbox";
import { Icon } from "../ui/icon";
import { PriorityFlag, type Priority } from "../ui/priority";
import { Tooltip } from "../ui/tooltip";

export interface TaskLite {
  id: string;
  title: string;
  priority: Priority;
  done?: boolean;
  due?: { label: string; overdue?: boolean };
  project?: { name: string; color: string };
}

interface TaskRowProps {
  task: TaskLite;
  onToggle: (id: string) => void;
  draggable?: boolean;
}

/**
 * One task in a list. Enter: springs in from above its slot. Complete: tick draws,
 * a strike draws across the title, then the parent removes it and siblings FLIP up.
 * Secondary actions appear on hover/focus only.
 */
export const TaskRow = forwardRef<HTMLLIElement, TaskRowProps>(function TaskRow({ task, onToggle, draggable }, ref) {
  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: duration.base, ease: ease.exit } }}
      transition={{ ...spring.pop, layout: spring.layout }}
      className="group relative flex items-start gap-3 border-b border-line py-3 pr-1 pl-1 focus-within:bg-surface hover:bg-surface"
    >
      {draggable && (
        <span
          data-cursor="drag"
          data-cursor-label="Drag"
          aria-hidden
          className="absolute top-3.5 -left-6 hidden text-ink-3 opacity-0 transition-opacity duration-(--dur-fast) group-hover:opacity-100 sm:block"
        >
          <Icon icon={GripVertical} />
        </span>
      )}
      <div className="pt-0.5">
        <TaskCheckbox
          checked={!!task.done}
          priority={task.priority}
          onCheckedChange={() => onToggle(task.id)}
          aria-label={`Complete “${task.title}”`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("relative w-fit max-w-full text-base leading-6 sm:text-sm sm:leading-6", task.done ? "text-ink-3" : "text-ink")}>
          {task.title}
          <motion.span
            aria-hidden
            className="absolute top-1/2 left-0 h-px w-full origin-left bg-ink-3"
            initial={false}
            animate={{ scaleX: task.done ? 1 : 0 }}
            transition={{ duration: duration.base, ease: ease.enter, delay: task.done ? 0.08 : 0 }}
          />
        </p>
        {(task.due || task.project || task.priority < 4) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
            {task.due && (
              <time className={cn("font-mono text-2xs", task.due.overdue ? "text-danger" : "text-ink-2")}>
                {task.due.label}
              </time>
            )}
            {task.priority < 4 && <PriorityFlag priority={task.priority} />}
            {task.project && (
              <span className="inline-flex items-center gap-1.5">
                <Dot className={task.project.color} />
                {task.project.name}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-0.5 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
        <Tooltip content="Reschedule" shortcut={["T"]}>
          <Button variant="ghost" size="icon-sm" aria-label="Reschedule" className="max-sm:hidden">
            <Icon icon={CalendarClock} />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="icon-sm" aria-label="More actions" data-cursor-label="More">
          <Icon icon={MoreHorizontal} />
        </Button>
      </div>
    </motion.li>
  );
});

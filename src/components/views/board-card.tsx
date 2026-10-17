"use client";

import { Repeat } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useCursorEnabled } from "@/components/cursor/custom-cursor";
import { TaskCheckbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { PriorityFlag } from "@/components/ui/priority";
import { distance, spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { formatDue } from "@/lib/dates";
import { projectDot } from "@/lib/project-colors";
import type { Project, Task } from "@/lib/types";

const MAX_TILT = 3;

/** Card used by Board and Matrix. Tilts slightly toward the pointer: a physical, movable thing. */
export function BoardCard({
  task,
  today,
  project,
  showPriority = true,
  compact,
  lifted,
  onOpen,
  onComplete,
}: {
  task: Task;
  today: string;
  project?: Pick<Project, "name" | "color">;
  showPriority?: boolean;
  compact?: boolean;
  lifted?: boolean;
  onOpen?: () => void;
  onComplete?: () => void;
}) {
  const tilt = useCursorEnabled() && !lifted;
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [MAX_TILT, -MAX_TILT]), spring.follow);
  const rotateY = useSpring(useTransform(px, [0, 1], [-MAX_TILT, MAX_TILT]), spring.follow);
  const overdue = !!task.dueDate && task.dueDate < today;

  return (
    <div style={{ perspective: 800 }}>
      <motion.div
        style={tilt ? { rotateX, rotateY } : undefined}
        initial={lifted ? { scale: 1, rotate: 0 } : false}
        animate={lifted ? { scale: distance.lift, rotate: -distance.liftTilt } : undefined}
        transition={spring.pop}
        onPointerMove={(e) => {
          if (!tilt) return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => (px.set(0.5), py.set(0.5))}
        className={cn(
          "group rounded-md bg-raised ring-1 ring-line ring-inset transition-shadow duration-(--dur-base)",
          compact ? "p-2.5" : "p-3",
          lifted ? "shadow-3" : "shadow-1 hover:shadow-2",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="pt-0.5" onPointerDown={(e) => e.stopPropagation()}>
            <TaskCheckbox
              checked={false}
              priority={task.priority}
              className="size-4"
              onCheckedChange={() => onComplete?.()}
              aria-label={`Complete: ${task.title}`}
            />
          </div>
          <button
            type="button"
            onClick={onOpen}
            onPointerDown={(e) => e.stopPropagation()}
            data-cursor-label="Open"
            className="min-w-0 flex-1 text-left text-sm leading-5 break-words text-ink"
          >
            {task.title}
          </button>
        </div>
        {(task.dueDate || (showPriority && task.priority < 4) || project || task.labels.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-6.5 text-xs text-ink-2">
            {task.dueDate && (
              <span className={cn("inline-flex items-center gap-1 font-mono text-2xs", overdue && "text-danger")}>
                {formatDue(task.dueDate, today, task.dueTime)}
                {task.recurrence && <Icon icon={Repeat} size="xs" label="Repeats" />}
              </span>
            )}
            {showPriority && task.priority < 4 && <PriorityFlag priority={task.priority} />}
            {task.labels.slice(0, 2).map((l) => (
              <span key={l} className="text-ink-3">
                @{l}
              </span>
            ))}
            {project && (
              <span className="ml-auto inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", projectDot(project.color))} />
                {project.name}
              </span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

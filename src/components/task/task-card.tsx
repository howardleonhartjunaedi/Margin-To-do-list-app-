"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { spring } from "@/design/motion";
import { cn } from "@/lib/cn";
import { useCursorEnabled } from "../cursor/custom-cursor";
import { Dot } from "../ui/badge";
import { PriorityFlag } from "../ui/priority";
import type { TaskLite } from "./task-row";

const MAX_TILT = 3; // degrees — perceptible depth, not a gimmick

/** Board card. A subtle perspective tilt toward the pointer says "this is a physical, movable thing". */
export function TaskCard({ task, className }: { task: TaskLite; className?: string }) {
  const tilt = useCursorEnabled();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [MAX_TILT, -MAX_TILT]), spring.follow);
  const rotateY = useSpring(useTransform(px, [0, 1], [-MAX_TILT, MAX_TILT]), spring.follow);

  return (
    <div style={{ perspective: 800 }} className={className}>
      <motion.article
        data-cursor="drag"
        data-cursor-label="Drag"
        tabIndex={0}
        style={tilt ? { rotateX, rotateY } : undefined}
        onPointerMove={(e) => {
          if (!tilt) return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          px.set(0.5);
          py.set(0.5);
        }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985 }}
        transition={spring.snappy}
        className={cn(
          "rounded-md bg-raised p-3 ring-1 ring-line ring-inset",
          "transition-shadow duration-(--dur-base) hover:shadow-2",
        )}
      >
        <p className="text-sm text-ink">{task.title}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-ink-2">
          {task.due && <time className="font-mono text-2xs">{task.due.label}</time>}
          <PriorityFlag priority={task.priority} />
          {task.project && (
            <span className="ml-auto inline-flex items-center gap-1.5">
              <Dot className={task.project.color} />
              {task.project.name}
            </span>
          )}
        </div>
      </motion.article>
    </div>
  );
}

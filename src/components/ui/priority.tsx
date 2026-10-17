import { Flag } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export type Priority = 1 | 2 | 3 | 4;

export const priorityMeta: Record<Priority, { label: string; text: string; soft: string }> = {
  1: { label: "Urgent", text: "text-p1", soft: "bg-danger-soft" },
  2: { label: "High", text: "text-p2", soft: "bg-warning-soft" },
  3: { label: "Normal", text: "text-p3", soft: "bg-sunken" },
  4: { label: "Someday", text: "text-p4", soft: "bg-sunken" },
};

/** Priority is never color alone: always the flag shape plus "P1" text. */
export function PriorityFlag({ priority, showLabel, className }: { priority: Priority; showLabel?: boolean; className?: string }) {
  const m = priorityMeta[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-2xs font-medium", m.text, className)}>
      <Icon icon={Flag} size="xs" fill={priority < 4 ? "currentColor" : "none"} />
      P{priority}
      {showLabel && <span className="font-sans text-xs font-normal text-ink-2">{m.label}</span>}
    </span>
  );
}

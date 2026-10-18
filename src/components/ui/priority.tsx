import { Flag } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { m } from "@/i18n/catalogs";

export type Priority = 1 | 2 | 3 | 4;

export const priorityMeta: Record<Priority, { text: string; soft: string }> = {
  1: { text: "text-p1", soft: "bg-danger-soft" },
  2: { text: "text-p2", soft: "bg-warning-soft" },
  3: { text: "text-p3", soft: "bg-sunken" },
  4: { text: "text-p4", soft: "bg-sunken" },
};

/** "Urgent", "High"… in the language on screen. */
export const priorityName = (p: Priority) => m().item.priorityNames[p - 1];

/** Priority is never color alone: always the flag shape plus "P1" text. */
export function PriorityFlag({ priority, showLabel, className }: { priority: Priority; showLabel?: boolean; className?: string }) {
  const meta = priorityMeta[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-2xs font-medium", meta.text, className)}>
      <Icon icon={Flag} size="xs" fill={priority < 4 ? "currentColor" : "none"} />
      P{priority}
      {showLabel && <span className="font-sans text-xs font-normal text-ink-2">{priorityName(priority)}</span>}
    </span>
  );
}

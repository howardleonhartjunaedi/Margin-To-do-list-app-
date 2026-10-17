"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { duration, ease } from "@/design/motion";
import { cn } from "@/lib/cn";
import type { Priority } from "./priority";

/** Square checkbox for settings and forms. */
export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer grid size-[18px] shrink-0 place-items-center rounded-sm bg-raised ring-[1.5px] ring-control ring-inset",
        "transition-[background-color,box-shadow,transform] duration-(--dur-fast) ease-enter active:scale-90",
        "data-[state=checked]:bg-ink data-[state=checked]:ring-ink",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator forceMount className="text-bg">
        <DrawnCheck checked={props.checked === true} size={12} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

const ringByPriority: Record<Priority, string> = {
  1: "ring-p1",
  2: "ring-p2",
  3: "ring-p3",
  4: "ring-control",
};
const fillByPriority: Record<Priority, string> = {
  1: "data-[state=checked]:bg-p1 data-[state=checked]:ring-p1",
  2: "data-[state=checked]:bg-p2 data-[state=checked]:ring-p2",
  3: "data-[state=checked]:bg-p3 data-[state=checked]:ring-p3",
  4: "data-[state=checked]:bg-ink-3 data-[state=checked]:ring-ink-3",
};

interface TaskCheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, "checked"> {
  checked: boolean;
  priority?: Priority;
}

/**
 * The task completion control. Circular, ringed in the task's priority color.
 * On check, the ring fills and the tick stroke draws in — confirming the action.
 */
export const TaskCheckbox = forwardRef<HTMLButtonElement, TaskCheckboxProps>(function TaskCheckbox(
  { checked, priority = 4, className, ...props },
  ref,
) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      className={cn(
        "group/check relative grid size-5 shrink-0 place-items-center rounded-full ring-[1.5px] ring-inset",
        "transition-[background-color,box-shadow,transform] duration-(--dur-fast) ease-enter active:scale-90",
        // Expand the hit target to 32px without changing layout
        "before:absolute before:-inset-1.5 before:content-['']",
        ringByPriority[priority],
        fillByPriority[priority],
        className,
      )}
      {...props}
    >
      {/* Hover preview of the tick so the affordance is obvious */}
      {!checked && (
        <span className="text-ink-3 opacity-0 transition-opacity duration-(--dur-fast) group-hover/check:opacity-100">
          <DrawnCheck checked size={11} instant />
        </span>
      )}
      <CheckboxPrimitive.Indicator forceMount className="absolute text-bg">
        <DrawnCheck checked={checked} size={11} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

function DrawnCheck({ checked, size, instant }: { checked: boolean; size: number; instant?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <motion.path
        d="M2.25 6.4 4.9 9 9.75 3.25"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={
          instant
            ? { duration: 0 }
            : {
                pathLength: { duration: duration.base, ease: ease.enter, delay: checked ? 0.04 : 0 },
                opacity: { duration: duration.fast },
              }
        }
      />
    </svg>
  );
}

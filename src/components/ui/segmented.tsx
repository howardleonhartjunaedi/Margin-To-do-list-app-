"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { motion } from "motion/react";
import { useId } from "react";
import { spring } from "@/design/motion";
import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Pick one of a few. The indicator slides to the new choice (shared layout),
 * showing where the selection went rather than blinking.
 */
export function Segmented<T extends string>({ value, onValueChange, options, label, size = "md", className }: SegmentedProps<T>) {
  const layoutId = useId();
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      orientation="horizontal"
      className={cn("inline-flex rounded-md bg-sunken p-0.5", className)}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          className={cn(
            "relative inline-flex items-center justify-center gap-1.5 rounded-sm font-medium text-ink-2",
            "transition-colors duration-(--dur-fast) hover:text-ink data-[state=checked]:text-ink",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
          )}
        >
          {o.value === value && (
            <motion.span
              layoutId={layoutId}
              // Only slide when the choice changes, not when the page around it reflows.
              layoutDependency={value}
              transition={spring.layout}
              className="absolute inset-0 rounded-sm bg-raised shadow-1"
            />
          )}
          <span className="relative inline-flex items-center gap-1.5">{o.label}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

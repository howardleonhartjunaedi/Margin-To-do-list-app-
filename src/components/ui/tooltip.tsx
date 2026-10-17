"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";
import { Kbd } from "./badge";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

interface TooltipProps {
  content: React.ReactNode;
  /** e.g. ["⌘", "K"] — shown as keys after the label */
  shortcut?: string[];
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
}

export function Tooltip({ content, shortcut, side = "top", children }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 inline-flex items-center gap-2 rounded-sm bg-ink px-2 py-1 text-xs text-bg shadow-2",
            "origin-(--radix-tooltip-content-transform-origin) data-[state=closed]:animate-fade-out",
            "data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in",
          )}
        >
          {content}
          {shortcut && (
            <span className="inline-flex gap-0.5">
              {shortcut.map((k) => (
                <Kbd key={k} className="bg-transparent text-bg/80 shadow-none ring-bg/30">
                  {k}
                </Kbd>
              ))}
            </span>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

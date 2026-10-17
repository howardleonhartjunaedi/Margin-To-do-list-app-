"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 ring-[1.5px] ring-control ring-inset",
        "bg-sunken transition-[background-color,box-shadow] duration-(--dur-base) ease-enter",
        "data-[state=checked]:bg-ink data-[state=checked]:ring-ink",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-5 rounded-full bg-raised shadow-1 ring-1 ring-line",
          "transition-transform duration-(--dur-base) ease-(--ease-spring) data-[state=checked]:translate-x-4",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

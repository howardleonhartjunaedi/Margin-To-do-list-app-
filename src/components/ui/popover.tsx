"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

/** Overlay surface shared by popovers and menus: raised, hairline, elevation 2. */
export const overlaySurface =
  "z-50 rounded-md bg-raised text-ink shadow-2 ring-1 ring-line outline-none";

/** Springs open from the trigger (Radix gives us the exact transform origin). */
export const overlayMotion =
  "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out [--pop-y:-4px] data-[side=top]:[--pop-y:4px]";

export const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent({ className, align = "start", sideOffset = 6, ...props }, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          overlaySurface,
          overlayMotion,
          "w-72 max-w-[calc(100vw-24px)] origin-(--radix-popover-content-transform-origin) p-3",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});

"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Kbd } from "./badge";
import { overlayMotion, overlaySurface } from "./popover";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof Menu.Content>,
  React.ComponentPropsWithoutRef<typeof Menu.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, align = "start", ...props }, ref) {
  return (
    <Menu.Portal>
      <Menu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          overlaySurface,
          overlayMotion,
          "min-w-52 origin-(--radix-dropdown-menu-content-transform-origin) p-1",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
});

interface ItemProps extends React.ComponentPropsWithoutRef<typeof Menu.Item> {
  icon?: React.ReactNode;
  shortcut?: string;
  tone?: "default" | "danger";
}

export const DropdownMenuItem = forwardRef<React.ElementRef<typeof Menu.Item>, ItemProps>(function DropdownMenuItem(
  { className, icon, shortcut, tone = "default", children, ...props },
  ref,
) {
  return (
    <Menu.Item
      ref={ref}
      className={cn(
        "flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2 text-sm outline-none select-none",
        "text-ink data-[highlighted]:bg-sunken data-[disabled]:opacity-45",
        tone === "danger" && "text-danger",
        className,
      )}
      {...props}
    >
      {icon && <span className="text-ink-3 [[data-highlighted]_&]:text-ink">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Menu.Item>
  );
});

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return <Menu.Label className="px-2 pt-2 pb-1 font-mono text-2xs tracking-wider text-ink-3 uppercase">{children}</Menu.Label>;
}

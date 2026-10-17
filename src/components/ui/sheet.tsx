"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Icon } from "./icon";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  /** Accessible name; visually hidden unless you render your own heading. */
  title: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Edge-anchored panel. Slides in from the side it lives on, so it's clear where it went
 * when it closes. Full-width on phones.
 */
export function Sheet({ open, onOpenChange, side = "right", title, className, children }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-lenis-prevent
          className={cn(
            "fixed inset-y-0 z-40 flex flex-col bg-bg text-ink shadow-3 outline-none",
            side === "right"
              ? "right-0 w-full border-l border-line data-[state=closed]:animate-sheet-out-right data-[state=open]:animate-sheet-in-right sm:w-[min(480px,100vw)]"
              : "left-0 w-[min(300px,86vw)] border-r border-line data-[state=closed]:animate-sheet-out-left data-[state=open]:animate-sheet-in-left",
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function SheetClose({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close asChild>
      <Button variant="ghost" size="icon-sm" aria-label="Close" className={className}>
        <Icon icon={X} />
      </Button>
    </DialogPrimitive.Close>
  );
}

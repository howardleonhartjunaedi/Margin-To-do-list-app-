"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Icon } from "./icon";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

// Where the last press happened — fallback origin when the trigger didn't take focus (Safari).
let lastPress = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => (lastPress = { x: e.clientX, y: e.clientY }), { capture: true, passive: true });
}

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  title: string;
  description?: string;
}

/**
 * Modal. Springs out of the element that opened it, so the eye follows cause to effect.
 * Use only for focused tasks or irreversible confirmations — everything else is inline.
 */
export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { className, title, description, children, ...props },
  forwarded,
) {
  // Ref callbacks run at commit, before paint and before Radix moves focus,
  // so activeElement is still the trigger when the content mounts.
  const setOrigin = useCallback((el: HTMLDivElement | null) => {
    if (!el || el.style.transformOrigin) return; // once per open; the node is fresh each time
    const trigger = document.activeElement;
    const r = trigger && trigger !== document.body ? trigger.getBoundingClientRect() : null;
    const ox = r ? r.left + r.width / 2 : lastPress.x;
    const oy = r ? r.top + r.height / 2 : lastPress.y;
    const box = el.getBoundingClientRect();
    el.style.transformOrigin = `${ox - box.left}px ${oy - box.top}px`;
  }, []);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-scrim p-4",
          "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        )}
        data-lenis-prevent
      >
        <DialogPrimitive.Content
          ref={(node) => {
            setOrigin(node);
            if (typeof forwarded === "function") forwarded(node);
            else if (forwarded) forwarded.current = node;
          }}
          className={cn(
            "relative w-full max-w-md rounded-md bg-raised p-6 text-ink shadow-3 ring-1 ring-line outline-none",
            "[--pop-scale:0.9] data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
            className,
          )}
          {...props}
        >
          <DialogPrimitive.Title className="pr-8 font-display text-xl font-medium">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1.5 text-sm text-ink-2">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          <div className="mt-5">{children}</div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" className="absolute top-4 right-4" aria-label="Close">
              <Icon icon={X} />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
});

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

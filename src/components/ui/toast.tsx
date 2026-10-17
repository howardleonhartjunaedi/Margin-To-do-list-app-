"use client";

import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { usePreferences } from "../providers/preferences";

/** Toasts stack bottom-left, out of the way of the primary action (bottom-right on mobile is the add button). */
export function Toaster() {
  const { resolvedTheme } = usePreferences();
  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-left"
      gap={8}
      visibleToasts={4}
      offset={16}
      mobileOffset={12}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-md bg-ink px-4 py-3 text-sm text-bg shadow-3 sm:w-[356px]",
          title: "font-medium",
          description: "text-bg/75 text-xs",
          actionButton:
            "ml-auto shrink-0 rounded-sm px-2 py-1 font-medium text-bg underline decoration-bg/40 underline-offset-4 hover:decoration-bg",
          cancelButton: "shrink-0 text-bg/70",
          icon: "text-bg",
        },
      }}
    />
  );
}

/** Every destructive or bulk action gets an Undo instead of a confirmation dialog. */
export function toastWithUndo(message: string, onUndo: () => void) {
  sonnerToast(message, { action: { label: "Undo", onClick: onUndo }, duration: 6000 });
}

export const toast = sonnerToast;

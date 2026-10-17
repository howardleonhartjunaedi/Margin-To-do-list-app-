"use client";

import { useEffect, useRef } from "react";

export function isTypingTarget(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName));
}

/**
 * Global single-key shortcuts and "g then x" sequences.
 * Ignored while typing, with modifier keys held, or while a dialog/menu is open.
 */
export function useHotkeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;
      const key = e.key.toLowerCase();
      const combo = pending ? `${pending} ${key}` : key;
      if (ref.current[combo]) {
        e.preventDefault();
        pending = null;
        ref.current[combo]();
        return;
      }
      if (!pending && Object.keys(ref.current).some((k) => k.startsWith(`${key} `))) {
        pending = key;
        clearTimeout(timer);
        timer = setTimeout(() => (pending = null), 900);
        return;
      }
      pending = null;
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, []);
}

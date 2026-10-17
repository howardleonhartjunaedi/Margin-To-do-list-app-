"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

/** True when the browser can morph between DOM states natively and motion is Full. */
export function canViewTransition() {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    document.visibilityState === "visible" && // a hidden tab gets no frames; don't make updates wait for one
    document.documentElement.dataset.motion === "full"
  );
}

/**
 * Run a synchronous React update inside a View Transition (old and new states
 * crossfade/morph per the ::view-transition rules in globals.css). Without
 * support, or with reduced motion, it just runs the update.
 */
export function withViewTransition(update: () => void) {
  if (!canViewTransition()) return update();
  (document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(() => flushSync(update));
}

/**
 * State mirrored to one URL search param, so a layout or filter is linkable and survives
 * reloads. Writes with history.replaceState (Next keeps useSearchParams in sync) instead
 * of a navigation, so switching is instant and nothing refetches.
 */
export function useUrlParam(key: string, fallback = "") {
  const params = useSearchParams();
  const fromUrl = params.get(key) ?? fallback;
  const [value, setValue] = useState(fromUrl);
  useEffect(() => setValue(fromUrl), [fromUrl]);

  const set = useCallback(
    (next: string, opts: { transition?: boolean } = {}) => {
      const apply = () => setValue(next);
      if (opts.transition) withViewTransition(apply);
      else apply();
      const url = new URL(window.location.href);
      if (next && next !== fallback) url.searchParams.set(key, next);
      else url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", url);
    },
    [key, fallback],
  );
  return [value, set] as const;
}

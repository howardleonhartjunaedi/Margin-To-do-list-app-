"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { duration, ease, spring } from "@/design/motion";
import { useCursorEnabled } from "./use-cursor-enabled";

/*
 * Custom cursor: a small dot plus a softly trailing ring.
 *
 * Markup hooks (on any element):
 *   data-cursor="drag"      → grab / grabbing state
 *   data-cursor="native"    → hand control back to the OS cursor (calendar grid, canvases)
 *   data-cursor="pointer"   → treat a non-semantic element as clickable
 *   data-cursor-label="Open"→ show a tiny label beside the ring
 * Text fields always get the native cursor.
 */

type Mode = "idle" | "hover" | "grab" | "native";

const NATIVE = 'input, textarea, select, [contenteditable="true"], [data-cursor="native"]';
const CLICKABLE =
  'a[href], button:not(:disabled), [role="button"], [role="checkbox"], [role="switch"], [role="tab"], [role="radio"], [role="menuitem"], [role="option"], label, summary, [data-cursor="pointer"]';

export { useCursorEnabled };

export function CustomCursor() {
  const enabled = useCursorEnabled();

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.dataset.cursor = "custom";
    else delete root.dataset.cursor;
    return () => {
      delete root.dataset.cursor;
    };
  }, [enabled]);

  return enabled ? <CursorLayer /> : null;
}

function CursorLayer() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, spring.follow);
  const ringY = useSpring(y, spring.follow);

  const [mode, setMode] = useState<Mode>("idle");
  const [label, setLabel] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
    };
    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest) return;
      const labelled = t.closest<HTMLElement>("[data-cursor-label]");
      setLabel(labelled?.dataset.cursorLabel ?? null);
      if (t.closest(NATIVE)) setMode("native");
      else if (t.closest('[data-cursor="drag"]')) setMode("grab");
      else if (t.closest(CLICKABLE)) setMode("hover");
      else setMode("idle");
    };
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) setVisible(false);
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    const hide = () => document.hidden && setVisible(false);

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("mouseout", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("mouseout", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [x, y]);

  const shown = visible && mode !== "native";
  const ringScale =
    mode === "hover" ? (pressed ? 1.25 : 1.5) : mode === "grab" ? (pressed ? 0.8 : 1.15) : pressed ? 0.8 : 1;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-100" style={{ contain: "strict" }}>
      {/* Ring — trails with spring physics; grows over clickables, tightens when grabbing */}
      <motion.div
        className="absolute top-0 left-0 -mt-4 -ml-4 size-8 rounded-full border-[1.5px] border-[#fff] mix-blend-difference"
        style={{ x: ringX, y: ringY }}
        animate={{
          scale: ringScale,
          opacity: shown ? 1 : 0,
          borderStyle: mode === "grab" ? "dashed" : "solid",
        }}
        transition={{ scale: spring.snappy, opacity: { duration: duration.fast } }}
      />
      {/* Dot — exact pointer position, the precise part */}
      <motion.div
        className="absolute top-0 left-0 -mt-[3px] -ml-[3px] size-1.5 rounded-full bg-[#fff] mix-blend-difference"
        style={{ x, y }}
        animate={{ scale: mode === "hover" ? 0 : 1, opacity: shown ? 1 : 0 }}
        transition={{ duration: duration.fast, ease: ease.enter }}
      />
      {/* Context label */}
      <motion.div className="absolute top-0 left-0" style={{ x: ringX, y: ringY }}>
        <AnimatePresence>
          {shown && label && (
            <motion.span
              key={label}
              initial={{ opacity: 0, scale: 0.9, x: 18, y: 14 }}
              animate={{ opacity: 1, scale: 1, x: 22, y: 18 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: duration.fast, ease: ease.enter }}
              className="block origin-top-left rounded-sm bg-ink px-1.5 py-0.5 font-mono text-2xs whitespace-nowrap text-bg"
            >
              {mode === "grab" && pressed ? "Drop" : label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

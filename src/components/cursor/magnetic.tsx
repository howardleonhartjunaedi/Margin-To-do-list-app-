"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef } from "react";
import { spring } from "@/design/motion";
import { useCursorEnabled } from "./custom-cursor";

const STRENGTH = 0.28;
const MAX = 8; // px — enough to feel, never enough to miss the click

/** Pulls its child a few pixels toward the pointer. No-op unless the custom cursor is active. */
export function Magnetic({ children }: { children: React.ReactNode }) {
  const enabled = useCursorEnabled();
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(useMotionValue(0), spring.follow);
  const y = useSpring(useMotionValue(0), spring.follow);

  if (!enabled) return <>{children}</>;

  const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));

  return (
    <motion.span
      ref={ref}
      data-magnetic=""
      className="inline-flex"
      style={{ x, y }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set(clamp((e.clientX - (r.left + r.width / 2)) * STRENGTH));
        y.set(clamp((e.clientY - (r.top + r.height / 2)) * STRENGTH));
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

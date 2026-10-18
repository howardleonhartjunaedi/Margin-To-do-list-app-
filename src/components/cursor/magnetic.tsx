"use client";

import { useRef } from "react";
import { useCursorEnabled } from "./use-cursor-enabled";

const STRENGTH = 0.28;
const MAX = 8; // px — enough to feel, never enough to miss the click

/**
 * Pulls its child a few pixels toward the pointer. No-op unless the custom cursor is active.
 * Plain transform + a CSS transition (the follow ease), so primary buttons on every page —
 * including the landing hero — don't need the animation library.
 */
export function Magnetic({ children }: { children: React.ReactNode }) {
  const enabled = useCursorEnabled();
  const ref = useRef<HTMLSpanElement>(null);

  if (!enabled) return <>{children}</>;

  const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));
  const move = (x: number, y: number) => {
    if (ref.current) ref.current.style.transform = x || y ? `translate3d(${x}px, ${y}px, 0)` : "";
  };

  return (
    <span
      ref={ref}
      data-magnetic=""
      className="inline-flex transition-transform duration-(--dur-base) ease-(--ease-move) will-change-transform"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        move(clamp((e.clientX - (r.left + r.width / 2)) * STRENGTH), clamp((e.clientY - (r.top + r.height / 2)) * STRENGTH));
      }}
      onPointerLeave={() => move(0, 0)}
    >
      {children}
    </span>
  );
}

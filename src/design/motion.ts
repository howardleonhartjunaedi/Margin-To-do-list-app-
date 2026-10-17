/**
 * Motion tokens (JS mirror of the CSS custom properties in globals.css).
 * Every animation in the app picks from these; nothing invents its own timing.
 *
 * Purpose rule: an animation must show where something came from, where it went,
 * or confirm an action. If it does none of those, don't add it.
 */

/** Seconds, for Motion. CSS equivalents: --dur-fast/base/slow/page. */
export const duration = {
  fast: 0.12, // hover, press, checkbox tick, tooltip
  base: 0.2, // popovers, toasts, row collapse
  slow: 0.32, // modals, list reflow, drawers
  page: 0.45, // route + view transitions
} as const;

/** Cubic-bezier control points. CSS equivalents: ease-enter / ease-move / ease-exit. */
export const ease = {
  /** Things arriving: fast start, long soft landing. */
  enter: [0.22, 1, 0.36, 1],
  /** Things moving from A to B on screen. */
  move: [0.65, 0, 0.35, 1],
  /** Things leaving: accelerate out of the way. */
  exit: [0.55, 0, 1, 0.45],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Spring presets for physical interactions. */
export const spring = {
  /** Press feedback, toggles, checkbox. Settles in ~150ms, no visible overshoot. */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.6 },
  /** Items entering a list, popovers from a trigger. Slight, honest overshoot. */
  pop: { type: "spring", stiffness: 380, damping: 26, mass: 0.8 },
  /** Layout reflow and reorder (FLIP). Calm, no overshoot. */
  layout: { type: "spring", stiffness: 300, damping: 34, mass: 1 },
  /** Dragged item following the pointer, cursor ring. */
  follow: { type: "spring", stiffness: 420, damping: 32, mass: 0.5 },
} as const;

/** Scale/translate amounts, so "a little" means the same thing everywhere. */
export const distance = {
  press: 0.97, // scale on :active
  lift: 1.03, // scale when dragging
  liftTilt: 1.5, // degrees of tilt when dragging
  enterY: 6, // px an entering popover travels
  popScale: 0.96, // scale an overlay starts from
} as const;

export type MotionLevel = "full" | "reduced" | "off";

export const cssEase = (e: readonly number[]) => `cubic-bezier(${e.join(", ")})`;

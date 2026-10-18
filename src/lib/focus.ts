import { m as messages } from "@/i18n/catalogs";
/*
 * Focus timer as a pure state machine. Times are epoch ms; the clock is passed in,
 * so it survives reloads (state is persisted) and is testable without fake timers.
 */

export type Phase = "focus" | "short" | "long";

export interface FocusSettings {
  focusMin: number;
  shortMin: number;
  longMin: number;
  /** A long break after this many focus rounds. */
  roundsPerLong: number;
}

export const DEFAULT_FOCUS: FocusSettings = { focusMin: 25, shortMin: 5, longMin: 15, roundsPerLong: 4 };

export interface TimerState {
  phase: Phase;
  taskId: string | null;
  startedAt: number;
  durationMs: number;
  /** Set while paused. */
  pausedAt: number | null;
  /** Total time spent paused so far. */
  pausedMs: number;
  /** Focus rounds finished in this sitting. */
  round: number;
}

export const phaseMinutes = (p: Phase, s: FocusSettings) => (p === "focus" ? s.focusMin : p === "short" ? s.shortMin : s.longMin);

export function start(phase: Phase, now: number, s: FocusSettings, taskId: string | null = null, round = 0): TimerState {
  return { phase, taskId, startedAt: now, durationMs: phaseMinutes(phase, s) * 60_000, pausedAt: null, pausedMs: 0, round };
}

export const elapsed = (t: TimerState, now: number) => (t.pausedAt ?? now) - t.startedAt - t.pausedMs;
export const remaining = (t: TimerState, now: number) => Math.max(0, t.durationMs - elapsed(t, now));
export const isDone = (t: TimerState, now: number) => remaining(t, now) === 0;
export const progress = (t: TimerState, now: number) => Math.min(1, elapsed(t, now) / t.durationMs);

export const pause = (t: TimerState, now: number): TimerState => (t.pausedAt ? t : { ...t, pausedAt: now });
export const resume = (t: TimerState, now: number): TimerState =>
  t.pausedAt ? { ...t, pausedAt: null, pausedMs: t.pausedMs + (now - t.pausedAt) } : t;

/** Add (or remove) minutes from the running phase, never below what's already elapsed + 1 min. */
export function adjust(t: TimerState, minutes: number, now: number): TimerState {
  const min = elapsed(t, now) + 60_000;
  return { ...t, durationMs: Math.max(min, t.durationMs + minutes * 60_000) };
}

/** What follows a finished phase: focus → short/long break → focus. */
export function next(t: TimerState, now: number, s: FocusSettings): TimerState {
  if (t.phase === "focus") {
    const round = t.round + 1;
    return start(round % s.roundsPerLong === 0 ? "long" : "short", now, s, t.taskId, round);
  }
  return start("focus", now, s, t.taskId, t.round);
}

/** "24:59", "1:05:00" */
export function clock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "25 min", "1 h 30 min" */
export function minutesLabel(min: number) {
  return messages().time.duration(Math.floor(min / 60), Math.round(min % 60));
}

import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { adjust, clock, DEFAULT_FOCUS, isDone, minutesLabel, next, pause, progress, remaining, resume, start } from "./focus";
import { checksThisWeek, keptRate, streak, weekStart } from "./habits";
import { parseQuickAdd } from "./quick-add/parse";
import { activeStreak, compact, deltaPct, fillDays, niceMax } from "./stats";

const today = "2026-10-18"; // Sunday
const set = (...days: number[]) => new Set(days.map((n) => addDays(today, n)));

describe("habit streaks", () => {
  it("daily: counts back from today, or from yesterday while today is open", () => {
    expect(streak(set(0, -1, -2), 7, today)).toEqual({ count: 3, unit: "day" });
    expect(streak(set(-1, -2), 7, today)).toEqual({ count: 2, unit: "day" });
    expect(streak(set(-2, -3), 7, today)).toEqual({ count: 0, unit: "day" });
    expect(streak(new Set(), 7, today).count).toBe(0);
  });

  it("weekly: whole weeks meeting the target; the current week counts once met", () => {
    expect(weekStart(today)).toBe("2026-10-12");
    // This week 3 checks (met), last week 3, the week before 2 (not met for target 3)
    const c = new Set(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-05", "2026-10-07", "2026-10-09", "2026-09-28", "2026-09-30"]);
    expect(streak(c, 3, today)).toEqual({ count: 2, unit: "week" });
    // Current week in progress (1 of 3) doesn't break it
    const d = new Set(["2026-10-13", "2026-10-05", "2026-10-07", "2026-10-09"]);
    expect(streak(d, 3, today)).toEqual({ count: 1, unit: "week" });
    expect(checksThisWeek(d, today)).toBe(1);
  });

  it("kept rate ignores today, the current week, and days before the habit existed", () => {
    expect(keptRate(set(-1, -2, -3, -4), 7, today, addDays(today, -10), 28)).toBeCloseTo(4 / 10);
    expect(keptRate(set(0), 7, today, today)).toBeNull();
    const c = new Set(["2026-10-05", "2026-10-07", "2026-10-09", "2026-09-28"]);
    expect(keptRate(c, 3, today, "2026-09-28", 28)).toBe(1 / 2);
  });
});

describe("focus timer", () => {
  const t0 = 1_000_000;
  it("counts down, pauses, resumes", () => {
    let t = start("focus", t0, DEFAULT_FOCUS, "task-1");
    expect(remaining(t, t0)).toBe(25 * 60_000);
    t = pause(t, t0 + 60_000);
    expect(remaining(t, t0 + 10 * 60_000)).toBe(24 * 60_000); // frozen while paused
    t = resume(t, t0 + 10 * 60_000);
    expect(remaining(t, t0 + 11 * 60_000)).toBe(23 * 60_000);
    expect(isDone(t, t0 + 34 * 60_000)).toBe(true);
    expect(progress(t, t0 + 34 * 60_000)).toBe(1);
  });

  it("alternates focus and breaks, with a long break every fourth round", () => {
    let t = start("focus", t0, DEFAULT_FOCUS);
    const phases: string[] = [];
    for (let i = 0; i < 8; i++) {
      t = next(t, t0, DEFAULT_FOCUS);
      phases.push(t.phase);
    }
    expect(phases).toEqual(["short", "focus", "short", "focus", "short", "focus", "long", "focus"]);
    expect(t.taskId).toBeNull();
  });

  it("adjusts but never below what's elapsed", () => {
    const t = start("focus", t0, DEFAULT_FOCUS);
    expect(adjust(t, 5, t0).durationMs).toBe(30 * 60_000);
    expect(adjust(t, -60, t0 + 10 * 60_000).durationMs).toBe(11 * 60_000);
  });

  it("formats", () => {
    expect(clock(25 * 60_000)).toBe("25:00");
    expect(clock(61_001)).toBe("1:02");
    expect(clock(3_600_000 + 5_000)).toBe("1:00:05");
    expect(minutesLabel(90)).toBe("1 h 30 min");
    expect(minutesLabel(45)).toBe("45 min");
  });
});

describe("stats helpers", () => {
  it("fills missing days", () => {
    expect(fillDays("2026-10-16", "2026-10-18", { "2026-10-17": 3 })).toEqual([
      { date: "2026-10-16", value: 0 },
      { date: "2026-10-17", value: 3 },
      { date: "2026-10-18", value: 0 },
    ]);
  });
  it("active-day streak", () => {
    expect(activeStreak(set(-1, -2, -4), today)).toBe(2);
    expect(activeStreak(set(0, -1), today)).toBe(2);
  });
  it("deltas, nice axes, compact numbers", () => {
    expect(deltaPct(12, 8)).toBe(50);
    expect(deltaPct(5, 0)).toBeNull();
    expect([niceMax(0), niceMax(3), niceMax(7), niceMax(18), niceMax(230)]).toEqual([1, 5, 10, 20, 500]);
    expect(compact(1284)).toBe("1,284");
    expect(compact(12_900)).toBe("12.9K");
  });
});

describe("quick add estimates", () => {
  const p = (s: string) => parseQuickAdd(s, { now: new Date(2026, 9, 18, 10) });
  it("parses ~durations", () => {
    expect(p("Write report ~45m")).toMatchObject({ estimateMinutes: 45, title: "Write report" });
    expect(p("Deep work ~2h tomorrow")).toMatchObject({ estimateMinutes: 120, dueDate: "2026-10-19" });
    expect(p("Clean garage ~1.5h").estimateMinutes).toBe(90);
    expect(p("Taxes ~1h30").estimateMinutes).toBe(90);
    expect(p("Taxes ~1h 30m").estimateMinutes).toBe(90);
    expect(p("Approx ~ things").estimateMinutes).toBeNull();
    expect(p("Read 30m").estimateMinutes).toBeNull(); // needs the ~
  });
});

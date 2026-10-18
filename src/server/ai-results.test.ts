import { describe, expect, it } from "vitest";
import { cleanSteps, cleanTriage } from "./ai-results";

const today = "2026-10-18";
const tasks = new Map([
  ["t1", { id: "task-1", title: "Book the car service", priority: 4 as const }],
  ["t2", { id: "task-2", title: "Pay rent", priority: 2 as const }],
]);
const projects = new Map([["p1", { id: "proj-home", name: "Home" }]]);
const raw = (o: Partial<Parameters<typeof cleanTriage>[0][number]>) => ({ taskId: "t1", projectId: null, dueDate: null, priority: 4, reason: "r", ...o });

describe("AI triage results are checked before anyone sees them", () => {
  it("maps short handles back to real ids and names", () => {
    expect(cleanTriage([raw({ projectId: "p1", dueDate: "2026-10-20", reason: "  car   stuff " })], tasks, projects, today)).toEqual([
      { taskId: "task-1", title: "Book the car service", projectId: "proj-home", projectName: "Home", dueDate: "2026-10-20", priority: 4, reason: "car stuff" },
    ]);
  });

  it("drops tasks and projects it wasn't given", () => {
    const out = cleanTriage([raw({ taskId: "t9", projectId: "p1" }), raw({ projectId: "proj-other", priority: 1 })], tasks, projects, today);
    expect(out).toHaveLength(1);
    expect(out[0].projectId).toBeNull();
    expect(out[0].priority).toBe(1);
  });

  it("ignores past, malformed and far-future dates, and impossible priorities", () => {
    for (const dueDate of ["2026-10-17", "next friday", "2030-01-01"]) {
      expect(cleanTriage([raw({ dueDate, priority: 3 })], tasks, projects, today)[0].dueDate).toBeNull();
    }
    expect(cleanTriage([raw({ priority: 7, projectId: "p1" })], tasks, projects, today)[0].priority).toBe(4);
  });

  it("skips suggestions that change nothing, and repeats", () => {
    expect(cleanTriage([raw({ taskId: "t2", priority: 2 })], tasks, projects, today)).toEqual([]);
    expect(cleanTriage([raw({ priority: 1 }), raw({ priority: 2 })], tasks, projects, today)).toHaveLength(1);
  });
});

describe("AI steps", () => {
  it("trims, drops empties, clamps estimates and caps the count", () => {
    const steps = cleanSteps([
      { title: "  Email   Sam ", estimateMinutes: 10.4 },
      { title: "   ", estimateMinutes: 5 },
      { title: "Measure the hall", estimateMinutes: -3 },
      { title: "Order paint", estimateMinutes: 99999 },
      ...Array.from({ length: 12 }, (_, i) => ({ title: `Step ${i}`, estimateMinutes: null })),
    ]);
    expect(steps[0]).toEqual({ title: "Email Sam", estimateMinutes: 10 });
    expect(steps[1]).toEqual({ title: "Measure the hall", estimateMinutes: null });
    expect(steps[2].estimateMinutes).toBe(1440);
    expect(steps).toHaveLength(10);
  });
});

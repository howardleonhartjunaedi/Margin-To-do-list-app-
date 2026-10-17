import { describe, expect, it } from "vitest";
import { applyFilter, decodeFilter, describeFilter, EMPTY_FILTER, encodeFilter, isEmptyFilter, type Filter } from "./filters";
import type { Task } from "./types";

const today = "2026-10-17";
const t = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2),
  projectId: null,
  parentId: null,
  title: "Task",
  notes: "",
  priority: 4,
  startDate: null,
  dueDate: null,
  dueTime: null,
  recurrence: null,
  sortKey: "a0",
  completedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  labels: [],
  subtaskCount: 0,
  subtaskDone: 0,
  ...over,
});

const tasks = [
  t({ id: "a", title: "Pay invoice", priority: 1, dueDate: "2026-10-15", projectId: "work", labels: ["Bills"] }),
  t({ id: "b", title: "Call mum", priority: 2, dueDate: today, labels: ["calls"] }),
  t({ id: "c", title: "Plan trip", priority: 3, dueDate: "2026-10-22", projectId: "home", notes: "Check the invoice for flights" }),
  t({ id: "d", title: "Read", priority: 4 }),
  t({ id: "e", title: "Renew lease", priority: 2, dueDate: "2026-11-30", projectId: "home" }),
];
const ids = (f: Partial<Filter>) => applyFilter(tasks, { ...EMPTY_FILTER, ...f }, today).map((x) => x.id);

describe("filters", () => {
  it("round-trips through the URL encoding", () => {
    const f: Filter = { priorities: [2, 1], projects: ["inbox", "p/1"], labels: ["calls", "a;b"], due: ["overdue", "none"], text: "foo; bar" };
    const back = decodeFilter(encodeFilter(f));
    expect(back).toEqual({ ...f, priorities: [1, 2] });
    expect(encodeFilter(EMPTY_FILTER)).toBe("");
  });

  it("ignores junk instead of throwing", () => {
    expect(decodeFilter("p:9,x,1;zz:1;d:soon,today;q:%E0%A4%A;pr")).toEqual({
      ...EMPTY_FILTER,
      priorities: [1],
      due: ["today"],
      text: "%E0%A4%A",
    });
    expect(isEmptyFilter(decodeFilter(null))).toBe(true);
  });

  it("ORs within a field and ANDs across fields", () => {
    expect(ids({ priorities: [1, 2] })).toEqual(["a", "b", "e"]);
    expect(ids({ priorities: [1, 2], projects: ["home"] })).toEqual(["e"]);
    expect(ids({ projects: ["inbox"] })).toEqual(["b", "d"]);
  });

  it("labels match case-insensitively", () => {
    expect(ids({ labels: ["bills"] })).toEqual(["a"]);
    expect(ids({ labels: ["CALLS", "bills"] })).toEqual(["a", "b"]);
  });

  it("due buckets", () => {
    expect(ids({ due: ["overdue"] })).toEqual(["a"]);
    expect(ids({ due: ["today"] })).toEqual(["b"]);
    expect(ids({ due: ["week"] })).toEqual(["b", "c"]);
    expect(ids({ due: ["none"] })).toEqual(["d"]);
    expect(ids({ due: ["overdue", "today"] })).toEqual(["a", "b"]);
    expect(ids({ due: ["dated"] })).toEqual(["a", "b", "c", "e"]);
  });

  it("text searches title and notes", () => {
    expect(ids({ text: "invoice" })).toEqual(["a", "c"]);
    expect(ids({ text: "  " })).toHaveLength(5);
  });

  it("describes itself for humans", () => {
    expect(describeFilter({ ...EMPTY_FILTER, priorities: [1], projects: ["home"], due: ["overdue"] }, [{ id: "home", name: "Home" }])).toBe(
      "P1 · Home · Overdue",
    );
    expect(describeFilter(EMPTY_FILTER)).toBe("Everything open");
  });
});

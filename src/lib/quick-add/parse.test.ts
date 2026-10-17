import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./parse";

// Saturday 17 October 2026, 10:00 local
const now = new Date(2026, 9, 17, 10, 0);
const projects = [
  { id: "p-home", name: "Home" },
  { id: "p-reno", name: "Home renovation" },
  { id: "p-work", name: "Work" },
];
const parse = (s: string) => parseQuickAdd(s, { now, projects });

describe("parseQuickAdd", () => {
  it("leaves a plain title alone", () => {
    const r = parse("Water the plants");
    expect(r).toMatchObject({ title: "Water the plants", dueDate: null, dueTime: null, priority: 4, project: null });
    expect(r.tokens).toEqual([]);
  });

  it("parses relative days", () => {
    expect(parse("Call mom tomorrow").dueDate).toBe("2026-10-18");
    expect(parse("Call mom today").dueDate).toBe("2026-10-17");
    expect(parse("Call mom tomorrow").title).toBe("Call mom");
  });

  it("looks forward for weekdays", () => {
    expect(parse("Standup notes friday").dueDate).toBe("2026-10-23");
    expect(parse("Standup notes on monday").title).toBe("Standup notes");
  });

  it("parses date with time", () => {
    const r = parse("Dentist next tuesday at 3pm");
    expect(r.dueDate).toBe("2026-10-20");
    expect(r.dueTime).toBe("15:00");
    expect(r.title).toBe("Dentist");
  });

  it("bare time today, or tomorrow once passed", () => {
    expect(parse("Call plumber at 2pm")).toMatchObject({ dueDate: "2026-10-17", dueTime: "14:00", title: "Call plumber" });
    expect(parse("Call plumber at 9am")).toMatchObject({ dueDate: "2026-10-18", dueTime: "09:00" });
  });

  it("parses explicit and relative dates", () => {
    expect(parse("Taxes due 3 Nov").dueDate).toBe("2026-11-03");
    expect(parse("Renew passport in 3 days").dueDate).toBe("2026-10-20");
    expect(parse("Book flights next week").dueDate).not.toBeNull();
  });

  it("priority p1–p4", () => {
    expect(parse("Fix leak p1")).toMatchObject({ priority: 1, title: "Fix leak" });
    expect(parse("p2 Fix leak")).toMatchObject({ priority: 2, title: "Fix leak" });
    expect(parse("Review p3 docs").priority).toBe(3);
    expect(parse("Buy mp3 player").priority).toBe(4);
  });

  it("matches projects by name or slug", () => {
    expect(parse("Paint hallway #home-renovation").project).toEqual({ id: "p-reno", name: "Home renovation" });
    expect(parse("Paint hallway #Home").project).toEqual({ id: "p-home", name: "Home" });
    expect(parse("Paint hallway #reno").project).toBeNull();
    expect(parse("Paint hallway #garden").unknownProject).toBe("garden");
  });

  it("collects labels", () => {
    const r = parse("Pay invoice @bills @Urgent @bills");
    expect(r.labels).toEqual(["bills", "Urgent"]);
    expect(r.title).toBe("Pay invoice");
  });

  it("recurrence sets a rule and a first date", () => {
    expect(parse("Stretch every day").recurrence).toEqual({ rrule: "FREQ=DAILY", label: "Every day" });
    expect(parse("Stretch every day").dueDate).toBe("2026-10-17");
    const r = parse("Team sync every monday at 9am");
    expect(r.recurrence?.rrule).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(r).toMatchObject({ dueDate: "2026-10-19", dueTime: "09:00", title: "Team sync" });
    expect(parse("Gym every mon and thu").recurrence?.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,TH");
    expect(parse("Standup every weekday").dueDate).toBe("2026-10-19");
    expect(parse("Water ferns every 2 weeks").recurrence?.rrule).toBe("FREQ=WEEKLY;INTERVAL=2");
  });

  it("monthly on a day", () => {
    const r = parse("Pay rent every 1st at 9am #home p1");
    expect(r.recurrence).toEqual({ rrule: "FREQ=MONTHLY;BYMONTHDAY=1", label: "Every month on the 1st" });
    expect(r).toMatchObject({ dueDate: "2026-11-01", dueTime: "09:00", priority: 1, title: "Pay rent" });
    expect(r.project?.id).toBe("p-home");
  });

  it("quotes are literal", () => {
    const r = parse('Read "Tomorrow and Tomorrow" friday');
    expect(r.title).toBe("Read Tomorrow and Tomorrow");
    expect(r.dueDate).toBe("2026-10-23");
  });

  it("doesn't treat numbers or ambiguous words as dates", () => {
    expect(parse("Read 1984").dueDate).toBeNull();
    expect(parse("Buy 3 lemons").dueDate).toBeNull();
    expect(parse("Ask if May can help").dueDate).toBeNull();
  });

  it("returns ordered token ranges that point at the input", () => {
    const input = "Dentist friday 3pm p2 #work";
    const r = parseQuickAdd(input, { now, projects });
    expect(r.tokens.map((t) => t.kind)).toEqual(["date", "priority", "project"]);
    for (const t of r.tokens) expect(input.slice(t.start, t.end)).toBe(t.text);
  });
});

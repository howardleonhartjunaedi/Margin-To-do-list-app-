import { describe, expect, it } from "vitest";
import { csvObjects, parseCsv, toCsv } from "./csv";
import { buildCalendar, escapeText, fold, type FeedTask } from "./ical";

describe("csv", () => {
  it("parses quotes, embedded commas and newlines, CRLF and a BOM", () => {
    const text = '﻿title,notes\r\n"Buy milk, eggs","line 1\nline 2"\r\nPlain,"He said ""hi"""\n\n';
    expect(parseCsv(text)).toEqual([
      ["title", "notes"],
      ["Buy milk, eggs", "line 1\nline 2"],
      ["Plain", 'He said "hi"'],
    ]);
  });
  it("round-trips through toCsv", () => {
    const rows = [["a", "b, c", 'd "e"', "f\ng", ""]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("defuses formula injection", () => {
    expect(toCsv([["=HYPERLINK(1)", "+1", "-2", "@x", "ok"]])).toBe("'=HYPERLINK(1),'+1,'-2,'@x,ok\r\n");
  });
  it("maps rows to objects by lower-cased header", () => {
    expect(csvObjects("Title, Due Date\nPay rent,2026-11-01\n")).toEqual([{ title: "Pay rent", "due date": "2026-11-01" }]);
  });
});

describe("ical", () => {
  const base: FeedTask = {
    id: "t1",
    title: "Dentist; bring card, forms",
    notes: "",
    startDate: null,
    dueDate: "2026-10-20",
    dueTime: null,
    estimateMinutes: null,
    recurrence: null,
    priority: 1,
    projectName: null,
    updatedAt: new Date("2026-10-18T00:00:00Z"),
  };
  const build = (ts: FeedTask[]) => buildCalendar(ts, { name: "Margin", timeZone: "Asia/Jakarta", baseUrl: "https://m.test", now: new Date("2026-10-18T01:02:03Z") });

  it("escapes text", () => {
    expect(escapeText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });
  it("folds long lines at 75 octets without splitting characters", () => {
    const long = "SUMMARY:" + "é".repeat(60);
    const folded = fold(long);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(long);
  });
  it("all-day events end the day after (exclusive), spans start on the start date", () => {
    const out = build([base, { ...base, id: "t2", startDate: "2026-10-18", dueDate: "2026-10-22" }]);
    expect(out).toContain("DTSTART;VALUE=DATE:20261020\r\nDTEND;VALUE=DATE:20261021");
    expect(out).toContain("DTSTART;VALUE=DATE:20261018\r\nDTEND;VALUE=DATE:20261023");
    expect(out).toContain("SUMMARY:Dentist\\; bring card\\, forms");
    expect(out.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("timed events use the zone and the estimate, crossing midnight correctly", () => {
    const out = build([{ ...base, dueTime: "23:30", estimateMinutes: 90, recurrence: "FREQ=WEEKLY;BYDAY=TU" }]);
    expect(out).toContain("DTSTART;TZID=Asia/Jakarta:20261020T233000");
    expect(out).toContain("DTEND;TZID=Asia/Jakarta:20261021T010000");
    expect(out).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU");
    expect(out).toContain("PRIORITY:1");
  });
});

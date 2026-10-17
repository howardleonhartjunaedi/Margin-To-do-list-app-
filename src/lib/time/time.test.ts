import { describe, expect, it } from "vitest";
import { advanceRecurring, nextOccurrence } from "./recurrence";
import { afterQuietHours, describeOffset, digestDue, inQuietHours, reminderInstant, snoozeUntil } from "./reminders";
import { instantToZoned, offsetMinutes, zonedToInstant } from "./zone";

const NY = "America/New_York";
const LDN = "Europe/London";
const JKT = "Asia/Jakarta";
const iso = (d: Date) => d.toISOString();

describe("zone", () => {
  it("converts wall clock to instant", () => {
    expect(iso(zonedToInstant("2026-10-17", "09:00", NY))).toBe("2026-10-17T13:00:00.000Z");
    expect(iso(zonedToInstant("2026-01-15", "09:00", NY))).toBe("2026-01-15T14:00:00.000Z");
    expect(iso(zonedToInstant("2026-10-17", "09:00", JKT))).toBe("2026-10-17T02:00:00.000Z");
    expect(iso(zonedToInstant("2026-07-01", "00:30", LDN))).toBe("2026-06-30T23:30:00.000Z");
  });

  it("moves nonexistent spring-forward times past the gap", () => {
    // 02:30 doesn't exist in New York on 8 Mar 2026; the clock jumps 02:00 → 03:00.
    const t = zonedToInstant("2026-03-08", "02:30", NY);
    expect(instantToZoned(t, NY)).toEqual({ date: "2026-03-08", time: "03:30" });
  });

  it("resolves ambiguous fall-back times to the earlier instant", () => {
    // 01:30 happens twice in New York on 1 Nov 2026; first is EDT (UTC-4).
    expect(iso(zonedToInstant("2026-11-01", "01:30", NY))).toBe("2026-11-01T05:30:00.000Z");
  });

  it("reports offsets", () => {
    expect(offsetMinutes(new Date("2026-01-01T12:00:00Z"), NY)).toBe(-300);
    expect(offsetMinutes(new Date("2026-07-01T12:00:00Z"), NY)).toBe(-240);
    expect(offsetMinutes(new Date("2026-07-01T12:00:00Z"), JKT)).toBe(420);
  });
});

describe("recurrence", () => {
  it("daily / interval", () => {
    expect(nextOccurrence("FREQ=DAILY", "2026-10-17")).toBe("2026-10-18");
    expect(nextOccurrence("FREQ=DAILY;INTERVAL=3", "2026-10-17")).toBe("2026-10-20");
  });

  it("weekly with and without days", () => {
    expect(nextOccurrence("FREQ=WEEKLY", "2026-10-17")).toBe("2026-10-24");
    // Sat 17 Oct → next Mon/Thu is Mon 19
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TH", "2026-10-17")).toBe("2026-10-19");
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TH", "2026-10-19")).toBe("2026-10-22");
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TH", "2026-10-22")).toBe("2026-10-26");
    expect(nextOccurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "2026-10-19")).toBe("2026-11-02");
    // Weekdays from Friday → Monday
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-10-16")).toBe("2026-10-19");
  });

  it("monthly clamps to short months", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=1", "2026-10-01")).toBe("2026-11-01");
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-02-28")).toBe("2026-03-31");
    expect(nextOccurrence("FREQ=MONTHLY", "2026-01-31")).toBe("2026-02-28");
  });

  it("yearly handles leap day", () => {
    expect(nextOccurrence("FREQ=YEARLY", "2028-02-29")).toBe("2029-02-28");
  });

  it("completing an overdue recurring task skips to the future", () => {
    // Daily task due 10 Oct, completed on 17 Oct → next is 18 Oct, not 11 Oct.
    expect(advanceRecurring("FREQ=DAILY", "2026-10-10", "2026-10-17")).toBe("2026-10-18");
    // Weekly on Monday, due last Monday, completed Saturday → next Monday
    expect(advanceRecurring("FREQ=WEEKLY;BYDAY=MO", "2026-10-12", "2026-10-17")).toBe("2026-10-19");
    // On time: just the next one
    expect(advanceRecurring("FREQ=WEEKLY", "2026-10-17", "2026-10-17")).toBe("2026-10-24");
    // No date yet: from today
    expect(advanceRecurring("FREQ=DAILY", null, "2026-10-17")).toBe("2026-10-18");
  });
});

describe("reminders", () => {
  const task = { dueDate: "2026-10-20", dueTime: "15:00" };

  it("relative to due time in the user's zone", () => {
    expect(iso(reminderInstant({ offsetMinutes: 30 }, task, NY)!)).toBe("2026-10-20T18:30:00.000Z");
    expect(iso(reminderInstant({ offsetMinutes: 0 }, task, JKT)!)).toBe("2026-10-20T08:00:00.000Z");
  });

  it("date-only tasks use the default day time", () => {
    expect(iso(reminderInstant({ offsetMinutes: 0 }, { dueDate: "2026-10-20", dueTime: null }, NY)!)).toBe("2026-10-20T13:00:00.000Z");
    expect(iso(reminderInstant({ offsetMinutes: 1440 }, { dueDate: "2026-10-20", dueTime: null }, NY, "08:00")!)).toBe(
      "2026-10-19T12:00:00.000Z",
    );
  });

  it("no due date means no relative reminder", () => {
    expect(reminderInstant({ offsetMinutes: 0 }, { dueDate: null, dueTime: null }, NY)).toBeNull();
  });

  it("quiet hours across midnight", () => {
    const q = { start: "22:00", end: "07:00" };
    expect(inQuietHours(zonedToInstant("2026-10-17", "23:15", LDN), q, LDN)).toBe(true);
    expect(inQuietHours(zonedToInstant("2026-10-17", "06:59", LDN), q, LDN)).toBe(true);
    expect(inQuietHours(zonedToInstant("2026-10-17", "07:00", LDN), q, LDN)).toBe(false);
    expect(inQuietHours(zonedToInstant("2026-10-17", "21:59", LDN), q, LDN)).toBe(false);
    // Late evening defers to tomorrow morning; early morning to this morning.
    expect(instantToZoned(afterQuietHours(zonedToInstant("2026-10-17", "23:15", LDN), q, LDN), LDN)).toEqual({ date: "2026-10-18", time: "07:00" });
    expect(instantToZoned(afterQuietHours(zonedToInstant("2026-10-18", "05:00", LDN), q, LDN), LDN)).toEqual({ date: "2026-10-18", time: "07:00" });
  });

  it("quiet hours within a day, and disabled", () => {
    const q = { start: "13:00", end: "14:00" };
    expect(inQuietHours(zonedToInstant("2026-10-17", "13:30", LDN), q, LDN)).toBe(true);
    expect(inQuietHours(zonedToInstant("2026-10-17", "14:30", LDN), q, LDN)).toBe(false);
    expect(inQuietHours(new Date(), null, LDN)).toBe(false);
  });

  it("quiet-hours end across a DST change lands on local wall time", () => {
    // UK clocks go back 25 Oct 2026 at 02:00.
    const q = { start: "22:00", end: "07:00" };
    const out = afterQuietHours(zonedToInstant("2026-10-24", "23:00", LDN), q, LDN);
    expect(instantToZoned(out, LDN)).toEqual({ date: "2026-10-25", time: "07:00" });
    expect(iso(out)).toBe("2026-10-25T07:00:00.000Z"); // GMT again
  });

  it("snooze", () => {
    const now = new Date("2026-10-17T13:00:00Z");
    expect(iso(snoozeUntil(now, { minutes: 10 }, NY))).toBe("2026-10-17T13:10:00.000Z");
    expect(iso(snoozeUntil(now, { tomorrowAt: "09:00" }, NY))).toBe("2026-10-18T13:00:00.000Z");
  });

  it("digest fires once per local day after its time", () => {
    const at = (t: string) => zonedToInstant("2026-10-17", t, JKT);
    expect(digestDue(at("07:59"), JKT, "08:00", null)).toBeNull();
    expect(digestDue(at("08:00"), JKT, "08:00", null)).toBe("2026-10-17");
    expect(digestDue(at("09:30"), JKT, "08:00", "2026-10-17")).toBeNull();
    expect(digestDue(at("09:30"), JKT, "08:00", "2026-10-16")).toBe("2026-10-17");
  });

  it("describes offsets", () => {
    expect(describeOffset(0)).toBe("At time of task");
    expect(describeOffset(30)).toBe("30 minutes before");
    expect(describeOffset(60)).toBe("1 hour before");
    expect(describeOffset(1440)).toBe("1 day before");
  });
});

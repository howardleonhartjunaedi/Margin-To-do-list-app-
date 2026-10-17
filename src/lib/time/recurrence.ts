import { addDays, fromISODate, toISODate, type ISODate } from "../dates";

/*
 * Next occurrence for the RRULE subset quick add produces:
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL=n, BYDAY=MO,TU…, BYMONTHDAY=d
 * Works on calendar dates only — times stay as the task's wall-clock time.
 */

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export interface Rule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byDay?: number[]; // 0 = Sunday
  byMonthDay?: number;
}

export function parseRule(rrule: string): Rule {
  const parts = Object.fromEntries(rrule.split(";").map((p) => p.split("=") as [string, string]));
  const freq = parts.FREQ as Rule["freq"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) throw new Error(`Unsupported FREQ in ${rrule}`);
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1)),
    byDay: parts.BYDAY?.split(",").map((d) => DAYS.indexOf(d)).filter((i) => i >= 0).sort(),
    byMonthDay: parts.BYMONTHDAY ? Number(parts.BYMONTHDAY) : undefined,
  };
}

const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/** Same day-of-month `months` later, clamped (Jan 31 + 1 month = Feb 28/29). */
function addMonthsClamped(date: ISODate, months: number, day?: number): ISODate {
  const d = fromISODate(date);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const want = day ?? d.getDate();
  target.setDate(Math.min(want, daysInMonth(target.getFullYear(), target.getMonth())));
  return toISODate(target);
}

/** The first occurrence strictly after `after`, starting from the series anchor `from`. */
export function nextOccurrence(rrule: string, from: ISODate, after: ISODate = from): ISODate {
  const r = parseRule(rrule);
  let cur = from;
  // Bounded loop: even daily rules only ever step a few hundred times.
  for (let i = 0; i < 5000; i++) {
    cur = step(r, cur);
    if (cur > after) return cur;
  }
  throw new Error("Recurrence did not advance");
}

function step(r: Rule, date: ISODate): ISODate {
  switch (r.freq) {
    case "DAILY":
      return addDays(date, r.interval);
    case "WEEKLY": {
      if (!r.byDay?.length) return addDays(date, 7 * r.interval);
      const dow = fromISODate(date).getDay();
      const laterThisWeek = r.byDay.find((d) => d > dow);
      if (laterThisWeek !== undefined) return addDays(date, laterThisWeek - dow);
      // Wrap to the first listed day, `interval` weeks on.
      return addDays(date, 7 * (r.interval - 1) + (7 - dow + r.byDay[0]));
    }
    case "MONTHLY":
      return addMonthsClamped(date, r.interval, r.byMonthDay);
    case "YEARLY":
      return addMonthsClamped(date, 12 * r.interval);
  }
}

/**
 * Where a recurring task goes when it's completed: the next occurrence after
 * its current due date — and if that's already past, the next one after today,
 * so finishing a long-overdue daily task doesn't leave it overdue again.
 */
export function advanceRecurring(rrule: string, dueDate: ISODate | null, today: ISODate): ISODate {
  const anchor = dueDate ?? today;
  const next = nextOccurrence(rrule, anchor, anchor);
  return next > today ? next : nextOccurrence(rrule, anchor, today);
}

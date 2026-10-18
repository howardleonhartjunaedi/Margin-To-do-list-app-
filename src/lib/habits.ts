import { addDays, daysBetween, fromISODate, type ISODate } from "./dates";
import { m } from "@/i18n/catalogs";

/*
 * Habits are kept per day (target 7/week) or per week (target 1–6/week).
 * Today is never a failure yet: an unchecked today just doesn't count —
 * the streak runs up to yesterday until the day is over.
 */

/** Monday of the week containing `d`. */
export const weekStart = (d: ISODate) => addDays(d, -((fromISODate(d).getDay() + 6) % 7));

export interface Streak {
  count: number;
  unit: "day" | "week";
}

export function streak(checks: Set<ISODate>, targetPerWeek: number, today: ISODate): Streak {
  if (targetPerWeek >= 7) {
    let d = checks.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (checks.has(d)) {
      n++;
      d = addDays(d, -1);
    }
    return { count: n, unit: "day" };
  }
  const inWeek = (monday: ISODate) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (checks.has(addDays(monday, i))) n++;
    return n;
  };
  let monday = weekStart(today);
  // The current week counts once it's met; until then it's still in play.
  let n = inWeek(monday) >= targetPerWeek ? 1 : 0;
  monday = addDays(monday, -7);
  while (inWeek(monday) >= targetPerWeek) {
    n++;
    monday = addDays(monday, -7);
  }
  return { count: n, unit: "week" };
}

/** Share of finished periods kept over the last `days` (excluding today / the current week, and before `since`). */
export function keptRate(checks: Set<ISODate>, targetPerWeek: number, today: ISODate, since: ISODate, days = 28): number | null {
  const start = [addDays(today, -days), since].sort().at(-1)!;
  if (targetPerWeek >= 7) {
    const total = daysBetween(start, today); // days before today
    if (total <= 0) return null;
    let kept = 0;
    for (let d = start; d < today; d = addDays(d, 1)) if (checks.has(d)) kept++;
    return kept / total;
  }
  let monday = weekStart(start);
  if (monday < start) monday = addDays(monday, 7); // only whole weeks
  const current = weekStart(today);
  let total = 0;
  let kept = 0;
  for (; monday < current; monday = addDays(monday, 7)) {
    total++;
    let n = 0;
    for (let i = 0; i < 7; i++) if (checks.has(addDays(monday, i))) n++;
    if (n >= targetPerWeek) kept++;
  }
  return total ? kept / total : null;
}

export const checksThisWeek = (checks: Set<ISODate>, today: ISODate) => {
  const monday = weekStart(today);
  let n = 0;
  for (let i = 0; i < 7; i++) if (checks.has(addDays(monday, i))) n++;
  return n;
};

export const describeTarget = (t: number) => (t >= 7 ? m().habits.everyDay : m().habits.perWeek(t));

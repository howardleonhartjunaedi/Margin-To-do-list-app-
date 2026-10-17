import { addDays, type ISODate } from "./dates";

/** Every day in [from, to] with its value (0 where the data has none). */
export function fillDays(from: ISODate, to: ISODate, values: Record<ISODate, number>) {
  const out: { date: ISODate; value: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, value: values[d] ?? 0 });
  return out;
}

/** Consecutive days with at least one completion, ending today (or yesterday if today has none yet). */
export function activeStreak(days: Set<ISODate>, today: ISODate) {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Signed change, as a whole percent, or null when there's no baseline. */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Round an axis max up to a clean number: 1, 2, 5, 10, 20, 50, … */
export function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** 1,284 → "1.3K" from 10,000 up; below that, grouped digits. */
export function compact(n: number) {
  if (n >= 10_000) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return new Intl.NumberFormat("en").format(Math.round(n));
}

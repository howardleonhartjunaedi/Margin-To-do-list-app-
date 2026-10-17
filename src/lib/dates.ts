/*
 * Dates are calendar days in the user's own timezone, stored as "YYYY-MM-DD".
 * Never convert them through UTC instants — that's how "today" becomes "yesterday".
 */

export type ISODate = string; // "2026-10-17"

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000);
}

export const todayISO = () => toISODate(new Date());

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "long" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("en", { weekday: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "HH:MM" (24h) → "14:00". Kept 24h + mono for scanability; locale formats come with i18n. */
export function formatTime(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

/** Human, relative where it helps: Today, Tomorrow, Friday, Mon 27 Oct, 3 Jan 2027. */
export function formatDue(date: ISODate, today: ISODate, time?: string | null): string {
  const diff = daysBetween(today, date);
  const d = fromISODate(date);
  let label: string;
  if (diff === 0) label = "Today";
  else if (diff === 1) label = "Tomorrow";
  else if (diff === -1) label = "Yesterday";
  else if (diff > 1 && diff < 7) label = WEEKDAY.format(d);
  else if (d.getFullYear() === fromISODate(today).getFullYear()) label = DAY_MONTH.format(d);
  else label = DAY_MONTH_YEAR.format(d);
  return time ? `${label} ${formatTime(time)}` : label;
}

export function weekdayShort(date: ISODate) {
  return WEEKDAY_SHORT.format(fromISODate(date));
}

export function dayHeading(date: ISODate, today: ISODate) {
  const diff = daysBetween(today, date);
  const d = fromISODate(date);
  const full = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
  if (diff === 0) return { title: "Today", sub: full };
  if (diff === 1) return { title: "Tomorrow", sub: full };
  return { title: WEEKDAY.format(d), sub: DAY_MONTH.format(d).replace(/^\w+,?\s/, "") };
}

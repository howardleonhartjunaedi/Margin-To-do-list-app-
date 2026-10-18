import { m } from "@/i18n/catalogs";
import type { Locale } from "@/i18n/locales";
import { currentLocale, intlTag } from "@/i18n/runtime";

/*
 * Dates are calendar days in the user's own timezone, stored as "YYYY-MM-DD".
 * Never convert them through UTC instants — that's how "today" becomes "yesterday".
 * Labels follow the language on screen (or the one passed in, for emails).
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

/* Formatters per language, made once. Relative words come from the catalog. */
const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: Locale, opts: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = formatters.get(key);
  if (!f) formatters.set(key, (f = new Intl.DateTimeFormat(intlTag(locale), opts)));
  return f;
}
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "long" };
const WEEKDAY_SHORT: Intl.DateTimeFormatOptions = { weekday: "short" };
const DAY_MONTH: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
const DAY_MONTH_PLAIN: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const LONG: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };

/** Any date-only value, in the current language. */
export function formatDate(date: ISODate, opts: Intl.DateTimeFormatOptions, locale: Locale = currentLocale()) {
  return fmt(locale, opts).format(fromISODate(date));
}

/** A JS Date (an instant or a month), in the current language. */
export function formatDateObj(d: Date, opts: Intl.DateTimeFormatOptions, locale: Locale = currentLocale()) {
  return fmt(locale, opts).format(d);
}

/** "HH:MM" (24h) → "14:00". 24h in every language: monospaced and scannable. */
export function formatTime(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

/** Human, relative where it helps: Today, Tomorrow, Friday, Mon 27 Oct, 3 Jan 2027. */
export function formatDue(date: ISODate, today: ISODate, time?: string | null, locale: Locale = currentLocale()): string {
  const words = m(locale).dates;
  const diff = daysBetween(today, date);
  const d = fromISODate(date);
  let label: string;
  if (diff === 0) label = words.today;
  else if (diff === 1) label = words.tomorrow;
  else if (diff === -1) label = words.yesterday;
  else if (diff > 1 && diff < 7) label = fmt(locale, WEEKDAY).format(d);
  else if (d.getFullYear() === fromISODate(today).getFullYear()) label = fmt(locale, DAY_MONTH).format(d);
  else label = fmt(locale, DAY_MONTH_YEAR).format(d);
  return time ? `${label} ${formatTime(time)}` : label;
}

/** "just now", "12 min ago", "3 h ago", "Yesterday 09:00", "Mon 20 Oct 09:00". Instants only. */
export function timeAgo(iso: string, now = new Date()): string {
  const words = m().dates;
  const t = new Date(iso);
  const min = Math.round((now.getTime() - t.getTime()) / 60_000);
  if (min < 1) return words.justNow;
  if (min < 60) return words.minAgo(min);
  if (min < 6 * 60) return words.hoursAgo(Math.round(min / 60));
  const hhmm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  return `${formatDue(toISODate(t), toISODate(now))} ${hhmm}`;
}

/** An instant as local "Tue 20 Oct 14:30" (or "Today 14:30"). */
export function formatInstant(iso: string, today: ISODate, locale: Locale = currentLocale()): string {
  const t = new Date(iso);
  return formatDue(toISODate(t), today, `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`, locale);
}

export function weekdayShort(date: ISODate) {
  return fmt(currentLocale(), WEEKDAY_SHORT).format(fromISODate(date));
}

export function dayHeading(date: ISODate, today: ISODate) {
  const locale = currentLocale();
  const words = m(locale).dates;
  const diff = daysBetween(today, date);
  const d = fromISODate(date);
  const full = fmt(locale, LONG).format(d);
  if (diff === 0) return { title: words.today, sub: full };
  if (diff === 1) return { title: words.tomorrow, sub: full };
  return { title: fmt(locale, WEEKDAY).format(d), sub: fmt(locale, DAY_MONTH_PLAIN).format(d) };
}

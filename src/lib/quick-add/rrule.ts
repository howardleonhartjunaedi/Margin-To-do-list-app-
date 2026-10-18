import { m } from "@/i18n/catalogs";
import { formatDate } from "../dates";

// 2024-01-01 was a Monday: weekday names come from Intl, in the language on screen.
const REF: Record<string, string> = { MO: "2024-01-01", TU: "2024-01-02", WE: "2024-01-03", TH: "2024-01-04", FR: "2024-01-05", SA: "2024-01-06", SU: "2024-01-07" };
const dayName = (d: string, style: "long" | "short") => formatDate(REF[d], { weekday: style });
const UNIT = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" } as const;

/** "FREQ=WEEKLY;BYDAY=MO,TH" → "Every Mon, Thu". Covers what quick add produces. */
export function describeRRule(rule: string): string {
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=") as [string, string]));
  const t = m().time;
  const unit = UNIT[parts.FREQ as keyof typeof UNIT] ?? "time";
  const n = Number(parts.INTERVAL ?? 1);
  if (parts.BYDAY) {
    const days = parts.BYDAY.split(",");
    if (days.join() === "MO,TU,WE,TH,FR") return t.everyWeekday;
    return t.everyOn(days.length === 1 ? dayName(days[0], "long") : days.map((d) => dayName(d, "short")).join(", "));
  }
  if (parts.BYMONTHDAY) return t.everyMonthOn(Number(parts.BYMONTHDAY));
  return t.every(unit, n);
}

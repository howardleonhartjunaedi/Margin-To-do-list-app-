const DAY: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
const FULL: Record<string, string> = { MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday" };
const UNIT: Record<string, string> = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" };

const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

/** "FREQ=WEEKLY;BYDAY=MO,TH" → "Every Mon, Thu". Covers what quick add produces. */
export function describeRRule(rule: string): string {
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=") as [string, string]));
  const unit = UNIT[parts.FREQ] ?? "time";
  const n = Number(parts.INTERVAL ?? 1);
  if (parts.BYDAY) {
    const days = parts.BYDAY.split(",");
    if (days.join() === "MO,TU,WE,TH,FR") return "Every weekday";
    return days.length === 1 ? `Every ${FULL[days[0]]}` : `Every ${days.map((d) => DAY[d]).join(", ")}`;
  }
  if (parts.BYMONTHDAY) return `Every month on the ${ordinal(Number(parts.BYMONTHDAY))}`;
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}

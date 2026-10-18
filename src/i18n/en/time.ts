type Unit = "day" | "week" | "month" | "year" | "time";
const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

export default {
  atTaskTime: "At time of task",
  offset: (n: number, unit: "minute" | "hour" | "day", before: boolean) => `${n} ${unit}${n === 1 ? "" : "s"} ${before ? "before" : "after"}`,
  every: (unit: Unit, n: number) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`),
  everyWeekday: "Every weekday",
  /** days: already-localized weekday names, e.g. "Monday" or "Mon, Thu" */
  everyOn: (days: string) => `Every ${days}`,
  everyMonthOn: (day: number) => `Every month on the ${ordinal(day)}`,
  duration: (h: number, m: number) => (h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`),
};

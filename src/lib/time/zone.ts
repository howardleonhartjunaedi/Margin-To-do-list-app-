/*
 * Wall-clock ↔ instant conversion in an IANA timezone, using only Intl.
 * Tasks store calendar dates and wall-clock times; reminders fire at instants.
 * This is the only bridge between the two.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string) {
  try {
    fmt(tz);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of `instant` as seen in `tz`. */
export function zonedParts(instant: Date, tz: string) {
  const p = Object.fromEntries(fmt(tz).formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Minutes east of UTC for `tz` at `instant` (e.g. +60 for Paris in winter). */
export function offsetMinutes(instant: Date, tz: string) {
  const z = zonedParts(instant, tz);
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The instant at which the wall clock in `tz` reads `date` `time`.
 * Nonexistent times (spring-forward gap) move forward by the gap;
 * ambiguous times (fall-back overlap) resolve to the earlier instant.
 */
export function zonedToInstant(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Try the offsets in effect a day either side; one of them is right.
  const candidates = [offsetMinutes(new Date(wall - 86_400_000), tz), offsetMinutes(new Date(wall + 86_400_000), tz)];
  const hits = candidates
    .map((off) => new Date(wall - off * 60_000))
    .filter((inst) => {
      const z = zonedParts(inst, tz);
      return Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute) === wall;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  if (hits.length) return hits[0];
  // In the gap: use the offset from before the transition, which lands after it.
  return new Date(wall - Math.min(...candidates) * 60_000);
}

/** Local calendar date ("YYYY-MM-DD") and time ("HH:MM") of `instant` in `tz`. */
export function instantToZoned(instant: Date, tz: string) {
  const z = zonedParts(instant, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${z.year}-${pad(z.month)}-${pad(z.day)}`, time: `${pad(z.hour)}:${pad(z.minute)}` };
}

/** Minutes since local midnight for an "HH:MM" string. */
export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

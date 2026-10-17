/*
 * RFC 5545 calendar feed for dated tasks.
 *   Date-only task   → all-day event on its date (or its start–due span)
 *   Task with a time → timed event in the user's time zone, lasting its estimate (or 30 min)
 *   Repeating task   → carries its RRULE
 */

export interface FeedTask {
  id: string;
  title: string;
  notes: string;
  startDate: string | null;
  dueDate: string;
  dueTime: string | null;
  estimateMinutes: number | null;
  recurrence: string | null;
  priority: number;
  projectName: string | null;
  updatedAt: Date;
}

/** Escape TEXT values: backslash, semicolon, comma, newline. */
export const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold to 75 octets per line (UTF-8 aware), continuation lines start with a space. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines lose one octet to the leading space
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const ymd = (d: string) => d.replace(/-/g, "");
const addDay = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Wall-clock arithmetic (no zone math needed: TZID tells the client which zone). */
function localPlus(date: string, time: string, minutes: number) {
  const t = new Date(`${date}T${time.slice(0, 5)}:00Z`);
  t.setUTCMinutes(t.getUTCMinutes() + minutes);
  const iso = t.toISOString();
  return `${iso.slice(0, 10).replace(/-/g, "")}T${iso.slice(11, 16).replace(":", "")}00`;
}

export function buildCalendar(tasks: FeedTask[], opts: { name: string; timeZone: string; baseUrl: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Margin//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `X-WR-TIMEZONE:${opts.timeZone}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const t of tasks) {
    const url = `${opts.baseUrl}/today?task=${t.id}`;
    const desc = [t.projectName && `Project: ${t.projectName}`, t.notes, url].filter(Boolean).join("\n\n");
    lines.push("BEGIN:VEVENT", `UID:${t.id}@margin`, `DTSTAMP:${stamp(now)}`, `LAST-MODIFIED:${stamp(t.updatedAt)}`);
    if (t.dueTime) {
      const start = `${ymd(t.dueDate)}T${t.dueTime.slice(0, 5).replace(":", "")}00`;
      lines.push(`DTSTART;TZID=${opts.timeZone}:${start}`, `DTEND;TZID=${opts.timeZone}:${localPlus(t.dueDate, t.dueTime, t.estimateMinutes ?? 30)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(t.startDate ?? t.dueDate)}`, `DTEND;VALUE=DATE:${ymd(addDay(t.dueDate, 1))}`, "TRANSP:TRANSPARENT");
    }
    if (t.recurrence) lines.push(`RRULE:${t.recurrence}`);
    lines.push(`SUMMARY:${escapeText(t.title)}`, `DESCRIPTION:${escapeText(desc)}`, `URL:${url}`, `PRIORITY:${[1, 3, 5, 9][t.priority - 1] ?? 9}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

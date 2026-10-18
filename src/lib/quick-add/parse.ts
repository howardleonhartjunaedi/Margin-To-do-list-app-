import type * as chrono from "chrono-node";
import { bilingual, ID_DAY_RE, idDayIndex } from "./indonesian";
import { toISODate, type ISODate } from "../dates";

/*
 * Natural-language quick add.
 *
 *   "Pay rent every 1st at 9am #home p1 @bills"
 *    → title "Pay rent", recurring monthly on the 1st, 09:00, project Home, P1, label bills
 *
 * Rules
 *  - p1–p4 sets priority; #project picks a project (matched by name, spaces as - or _);
 *    @label adds a label; "every …" / daily / weekly sets a recurrence.
 *  - Dates and times are found by chrono, always looking forward ("friday" = the next one).
 *  - Anything in "double quotes" is taken literally and never parsed.
 *  - Every match is returned as a token with its character range so the input can
 *    highlight exactly what was understood, and the user can see why.
 */

export type TokenKind = "date" | "priority" | "project" | "label" | "recurrence" | "estimate";

export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  text: string;
}

export interface ParsedTask {
  title: string;
  dueDate: ISODate | null;
  dueTime: string | null; // "HH:MM"
  priority: 1 | 2 | 3 | 4;
  project: { id: string; name: string } | null;
  /** A #tag that didn't match any project — offered as "create project" in the UI. */
  unknownProject: string | null;
  labels: string[];
  recurrence: { rrule: string; label: string } | null;
  /** "~30m", "~1.5h", "~1h30" */
  estimateMinutes: number | null;
  tokens: Token[];
}

export interface ParseOptions {
  now?: Date;
  projects?: { id: string; name: string }[];
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const RRULE_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_RE = "(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?s?";

const dayIndex = (word: string) => DAYS.findIndex((d) => d.startsWith(word.toLowerCase().slice(0, 3)));
const slug = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "-");
const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

interface Recurrence {
  rrule: string;
  label: string;
  /** First occurrence on or after `now`, if the rule implies one. */
  first: (now: Date) => Date | null;
}

/** "setiap senin dan kamis" → "every monday and thursday": Indonesian repeats reuse the English rules. */
function fromIndonesian(p: string): string {
  const EN_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return p
    .replace(/^(?:setiap|tiap)\s+/, "every ")
    .replace(/^harian$/, "daily")
    .replace(/^mingguan$/, "weekly")
    .replace(/^bulanan$/, "monthly")
    .replace(/^tahunan$/, "yearly")
    .replace(/^every hari kerja$/, "every weekday")
    .replace(/^every (?:hari\s+)?(?=(?:senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)\b(?!\s+depan))/, "every ")
    .replace(/^every (\d+) (hari|minggu|pekan|bulan|tahun)$/, (_m, n, u) => `every ${n} ${{ hari: "day", minggu: "week", pekan: "week", bulan: "month", tahun: "year" }[u as "hari"]}`)
    .replace(/^every (hari|minggu|pekan|bulan|tahun)$/, (_m, u) => `every ${{ hari: "day", minggu: "week", pekan: "week", bulan: "month", tahun: "year" }[u as "hari"]}`)
    .replace(/^every tanggal (\d{1,2})$/, "every $1")
    .replace(/\b(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)\b/g, (d) => EN_DAYS[idDayIndex(d)])
    .replace(/ dan /g, " and ");
}

function parseRecurrence(phrase: string): Recurrence | null {
  const p = fromIndonesian(phrase.toLowerCase().replace(/\s+/g, " ").trim());
  const today = (now: Date) => now;

  if (/^(every ?day|daily)$/.test(p)) return { rrule: "FREQ=DAILY", label: "Every day", first: today };
  if (/^every weekday$/.test(p))
    return {
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      label: "Every weekday",
      first: (now) => {
        const d = new Date(now);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        return d;
      },
    };
  if (/^(every week|weekly)$/.test(p)) return { rrule: "FREQ=WEEKLY", label: "Every week", first: today };
  if (/^every other week$/.test(p)) return { rrule: "FREQ=WEEKLY;INTERVAL=2", label: "Every 2 weeks", first: today };
  if (/^(every month|monthly)$/.test(p)) return { rrule: "FREQ=MONTHLY", label: "Every month", first: today };
  if (/^(every year|yearly|annually)$/.test(p)) return { rrule: "FREQ=YEARLY", label: "Every year", first: today };

  let m = p.match(/^every (\d+) (day|week|month|year)s?$/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    return {
      rrule: `FREQ=${{ day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" }[unit]};INTERVAL=${n}`,
      label: n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`,
      first: today,
    };
  }

  m = p.match(/^every (\d{1,2})(?:st|nd|rd|th)?(?: of the month)?$/);
  if (m) {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return null;
    return {
      rrule: `FREQ=MONTHLY;BYMONTHDAY=${day}`,
      label: `Every month on the ${ordinal(day)}`,
      first: (now) => {
        const d = new Date(now.getFullYear(), now.getMonth(), day);
        if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setMonth(d.getMonth() + 1);
        return d;
      },
    };
  }

  m = p.match(new RegExp(`^every ((?:${DAY_RE})(?:(?:, ?| and | & )(?:${DAY_RE}))*)$`));
  if (m) {
    const days = [...new Set(m[1].split(/, ?| and | & /).map(dayIndex))].filter((i) => i >= 0).sort();
    if (!days.length) return null;
    const names = days.map((i) => DAYS[i][0].toUpperCase() + DAYS[i].slice(1, 3));
    return {
      rrule: `FREQ=WEEKLY;BYDAY=${days.map((i) => RRULE_DAY[i]).join(",")}`,
      label: days.length === 1 ? `Every ${DAYS[days[0]][0].toUpperCase()}${DAYS[days[0]].slice(1)}` : `Every ${names.join(", ")}`,
      first: (now) => {
        const d = new Date(now);
        for (let i = 0; i < 7; i++, d.setDate(d.getDate() + 1)) if (days.includes(d.getDay())) return d;
        return null;
      },
    };
  }
  return null;
}

const RECURRENCE_RE = new RegExp(
  [
    "\\bevery (?:other )?(?:day|weekday|week|month|year)\\b",
    "\\bevery \\d+ (?:days?|weeks?|months?|years?)\\b",
    "\\bevery \\d{1,2}(?:st|nd|rd|th)?(?: of the month)?\\b",
    `\\bevery (?:${DAY_RE})(?:(?:, ?| and | & )(?:${DAY_RE}))*\\b`,
    "\\bevery ?day\\b",
    "\\b(?:daily|weekly|monthly|yearly|annually)\\b",
    // Bahasa Indonesia
    "\\b(?:setiap|tiap) hari kerja\\b",
    "\\b(?:setiap|tiap) \\d+ (?:hari|minggu|pekan|bulan|tahun)\\b",
    "\\b(?:setiap|tiap) tanggal \\d{1,2}\\b",
    `\\b(?:setiap|tiap) (?:hari )?${ID_DAY_RE}(?: dan ${ID_DAY_RE}|, ?${ID_DAY_RE})*\\b(?! depan)`,
    "\\b(?:setiap|tiap) (?:hari|minggu|pekan|bulan|tahun)\\b",
    "\\b(?:harian|mingguan|bulanan|tahunan)\\b",
  ].join("|"),
  "gi",
);

export function parseQuickAdd(input: string, opts: ParseOptions = {}): ParsedTask {
  const now = opts.now ?? new Date();
  const projects = opts.projects ?? [];
  const tokens: Token[] = [];

  // Working copy where consumed or quoted ranges are blanked out (same length, so indexes line up).
  let masked = input.replace(/"[^"]*"/g, (q) => " ".repeat(q.length));
  const take = (kind: TokenKind, start: number, end: number) => {
    tokens.push({ kind, start, end, text: input.slice(start, end) });
    masked = masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end);
  };

  // Priority — last one wins
  let priority: ParsedTask["priority"] = 4;
  for (const m of masked.matchAll(/(?<=^|\s)p([1-4])(?=\s|$)/gi)) {
    priority = Number(m[1]) as ParsedTask["priority"];
    take("priority", m.index!, m.index! + m[0].length);
  }

  // Estimate — "~45m", "~2h", "~1h30"
  let estimateMinutes: number | null = null;
  const em = masked.match(/(?<=^|\s)~(\d+(?:\.\d+)?)\s?(h|hrs?|hours?|j|jam|m|mins?|minutes?|mnt|menit)(?:\s?(\d{1,2})\s?(?:m|mins?|mnt)?)?(?=\s|$)/i);
  if (em) {
    const n = Number(em[1]);
    const minutes = /^[hj]/i.test(em[2]) ? n * 60 + Number(em[3] ?? 0) : n;
    if (minutes > 0 && minutes <= 24 * 60) {
      estimateMinutes = Math.round(minutes);
      take("estimate", em.index!, em.index! + em[0].length);
    }
  }

  // Project — first #tag
  let project: ParsedTask["project"] = null;
  let unknownProject: string | null = null;
  const pm = masked.match(/(?<=^|\s)#([\p{L}\p{N}_-]+)/u);
  if (pm) {
    const wanted = slug(pm[1]);
    const hit = projects.find((p) => slug(p.name) === wanted) ?? projects.find((p) => slug(p.name).startsWith(wanted));
    if (hit) project = { id: hit.id, name: hit.name };
    else unknownProject = pm[1].replace(/[-_]+/g, " ");
    take("project", pm.index!, pm.index! + pm[0].length);
  }

  // Labels
  const labels: string[] = [];
  for (const m of masked.matchAll(/(?<=^|\s)@([\p{L}\p{N}_-]+)/gu)) {
    if (!labels.some((l) => l.toLowerCase() === m[1].toLowerCase())) labels.push(m[1]);
    take("label", m.index!, m.index! + m[0].length);
  }

  // Recurrence
  let recurrence: Recurrence | null = null;
  for (const m of masked.matchAll(RECURRENCE_RE)) {
    const r = parseRecurrence(m[0]);
    if (r && !recurrence) {
      recurrence = r;
      take("recurrence", m.index!, m.index! + m[0].length);
    }
  }

  // Date & time
  let dueDate: ISODate | null = null;
  let dueTime: string | null = null;
  const [hit] = bilingual.parse(masked, now, { forwardDate: true });
  if (hit && isPlausibleDate(hit)) {
    const start = hit.start;
    const d = start.date();
    const hasDay = start.isCertain("day") || start.isCertain("weekday") || start.isCertain("month");
    const first = recurrence?.first(now);
    if (!hasDay && recurrence && first) {
      // "every monday at 9am": the rule picks the day, chrono only the time.
      dueDate = toISODate(first);
    } else {
      // A bare time ("at 5pm") means today, or tomorrow if that time has passed.
      if (!hasDay && start.isCertain("hour") && d < now) d.setDate(d.getDate() + 1);
      if (hasDay || start.isCertain("hour")) dueDate = toISODate(d);
    }
    if (start.isCertain("hour")) {
      dueTime = `${String(start.get("hour")).padStart(2, "0")}:${String(start.get("minute") ?? 0).padStart(2, "0")}`;
    }
    // Include a leading "on"/"at"/"by"/"due" in the consumed range so it leaves the title.
    let s = hit.index;
    const lead = masked.slice(0, s).match(/\b(?:on|at|by|due|for|pada|tanggal|tgl)\s+$/i);
    if (lead) s -= lead[0].length;
    take("date", s, hit.index + hit.text.length);
  }
  if (recurrence && !dueDate) {
    const first = recurrence.first(now);
    if (first) dueDate = toISODate(first);
  }

  // Title: what's left of the original once tokens are removed (quotes keep their text, lose the marks)
  const consumed = new Set<number>();
  for (const t of tokens) for (let i = t.start; i < t.end; i++) consumed.add(i);
  const title = [...input]
    .map((ch, i) => (consumed.has(i) ? " " : ch))
    .join("")
    .replace(/"([^"]*)"/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  tokens.sort((a, b) => a.start - b.start);
  return {
    title,
    dueDate,
    dueTime,
    priority,
    project,
    unknownProject,
    labels,
    recurrence: recurrence && { rrule: recurrence.rrule, label: recurrence.label },
    estimateMinutes,
    tokens,
  };
}

/** Reject chrono hits that are almost always part of a title, not a date. */
function isPlausibleDate(r: chrono.ParsedResult) {
  const text = r.text.trim().toLowerCase();
  // Bare numbers ("Read 1984", "Buy 3") and lone month words used as verbs/names ("May", "March")
  if (/^\d+$/.test(text)) return false;
  if (/^(may|march|sat|sun|wed)$/.test(text)) return false;
  return true;
}

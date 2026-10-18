import * as chrono from "chrono-node";

/*
 * Bahasa Indonesia for quick add, layered onto chrono's English parser so both languages work
 * in the same box: "besok jam 2 siang", "jumat", "3 hari lagi", "pukul 14.30", "minggu depan".
 * Adjacent date and time results merge as they do in English ("besok jam 9 pagi").
 */

/** Indexed by Date#getDay(): 0 = Sunday. */
export const ID_DAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
export const ID_DAY_RE = "(?:senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)";
export const idDayIndex = (w: string) => ID_DAYS.indexOf(w.toLowerCase().replace("'", ""));

const at = (ref: Date, days: number) => {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + days);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
};

const relativeDay: chrono.Parser = {
  pattern: () => /(?<![\p{L}\p{N}])(hari ini|besok|lusa)(?![\p{L}\p{N}])/iu,
  extract: (ctx, m) => at(ctx.refDate, { "hari ini": 0, besok: 1, lusa: 2 }[m[1].toLowerCase() as "besok"]),
};

const relativeSpan: chrono.Parser = {
  // "minggu depan" (next Monday), "bulan depan" (same day next month), "akhir pekan" (Saturday)
  pattern: () => /(?<![\p{L}\p{N}])(minggu depan|pekan depan|bulan depan|akhir pekan)(?![\p{L}\p{N}])/iu,
  extract: (ctx, m) => {
    const ref = ctx.refDate;
    const w = m[1].toLowerCase();
    if (w === "bulan depan") return { day: ref.getDate(), month: ((ref.getMonth() + 1) % 12) + 1, year: ref.getFullYear() + (ref.getMonth() === 11 ? 1 : 0) };
    if (w === "akhir pekan") return at(ref, (6 - ref.getDay() + 7) % 7);
    return at(ref, ((8 - ref.getDay()) % 7) || 7);
  },
};

const inDays: chrono.Parser = {
  // "3 hari lagi", "dalam 2 minggu"
  pattern: () => /(?<![\p{L}\p{N}])(?:dalam\s+(\d{1,3})\s+(hari|minggu|pekan)|(\d{1,3})\s+(hari|minggu|pekan)\s+lagi)(?![\p{L}\p{N}])/iu,
  extract: (ctx, m) => {
    const n = Number(m[1] ?? m[3]);
    const unit = (m[2] ?? m[4]).toLowerCase();
    return at(ctx.refDate, unit === "hari" ? n : n * 7);
  },
};

const weekday: chrono.Parser = {
  // "jumat", "hari senin", "selasa depan" — always the next one ("depan" skips this week's)
  pattern: () => new RegExp(`(?<![\\p{L}\\p{N}])(?:hari\\s+)?(${ID_DAY_RE})(?:\\s+(depan|ini))?(?![\\p{L}\\p{N}])`, "iu"),
  extract: (ctx, m) => {
    const target = idDayIndex(m[1]);
    let diff = (target - ctx.refDate.getDay() + 7) % 7;
    if (m[2]?.toLowerCase() === "depan" && diff === 0) diff = 7;
    return at(ctx.refDate, diff);
  },
};

const time: chrono.Parser = {
  // "jam 3 sore", "pukul 14.30", "pkl 9 pagi", "jam 12 malam"
  pattern: () => /(?<![\p{L}\p{N}])(?:jam|pukul|pkl\.?)\s*(\d{1,2})(?:[.:](\d{2}))?(?:\s*(pagi|siang|sore|malam))?(?![\p{L}\p{N}])/iu,
  extract: (_ctx, m) => {
    let hour = Number(m[1]);
    const minute = Number(m[2] ?? 0);
    const part = m[3]?.toLowerCase();
    if (hour > 23 || minute > 59) return null;
    if (part === "pagi" && hour === 12) hour = 0;
    else if (part === "siang" && hour < 11) hour += 12;
    else if (part === "sore" && hour < 12) hour += 12;
    else if (part === "malam") hour = hour === 12 ? 0 : hour < 6 ? hour : hour < 12 ? hour + 12 : hour;
    return { hour, minute };
  },
};

/** English casual parsing plus Indonesian dates and times. */
export const bilingual = (() => {
  const c = chrono.en.casual.clone();
  c.parsers.push(relativeSpan, relativeDay, inDays, weekday, time);
  return c;
})();

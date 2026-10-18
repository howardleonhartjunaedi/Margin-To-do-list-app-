/** Interface languages. Add one here and give it a catalog in ./messages. */
export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language's own name for itself, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", id: "Bahasa Indonesia" };

/** BCP 47 tags for Intl formatting (dates, numbers, plurals). */
export const INTL_TAG: Record<Locale, string> = { en: "en-GB", id: "id-ID" };
/** Number formatting: plain "en" keeps "12.9K" (en-GB writes "12.9k"). */
export const NUMBER_TAG: Record<Locale, string> = { en: "en", id: "id-ID" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** The best supported match for an Accept-Language header (or navigator.languages). */
export function matchLocale(accept: string | readonly string[] | null | undefined): Locale {
  const wanted = typeof accept === "string" ? accept.split(",").map((p) => p.split(";")[0].trim()) : (accept ?? []);
  for (const tag of wanted) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

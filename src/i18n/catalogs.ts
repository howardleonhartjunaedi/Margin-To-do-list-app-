import type { Locale } from "./locales";
import { currentLocale } from "./runtime";
import en from "./en";
import id from "./id";

/** Every app string, per language. English is the reference: other languages must match its shape. */
export type Messages = typeof en;

export const catalogs: Record<Locale, Messages> = { en, id };

/** Strings for the language on screen, for code outside components. Components use useT(). */
export const m = (locale: Locale = currentLocale()): Messages => catalogs[locale];

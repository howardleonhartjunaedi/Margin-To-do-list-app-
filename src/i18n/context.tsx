"use client";

import { createContext, useContext, useEffect } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { setCurrentLocale } from "./runtime";

/*
 * The language in effect, with no strings attached: importing this costs almost nothing,
 * so the landing page can use it without shipping the app's catalogs. Strings: ./client (useT).
 */

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Puts a language in effect for everything below it (and for formatting outside components). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  setCurrentLocale(locale); // during render, so formatting in this render already uses it
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

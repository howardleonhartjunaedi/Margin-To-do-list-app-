import { DEFAULT_LOCALE, INTL_TAG, NUMBER_TAG, type Locale } from "./locales";

/*
 * The language currently on screen, for code that isn't a component (date formatting, toasts
 * from the data layer). Tiny on purpose: it carries no strings, so importing it costs nothing.
 * Components read the language from context (useLocale); I18nProvider keeps this in step.
 */

let current: Locale = DEFAULT_LOCALE;

export const setCurrentLocale = (l: Locale) => {
  current = l;
};
export const currentLocale = () => current;
export const intlTag = (l: Locale = current) => INTL_TAG[l];
export const numberTag = (l: Locale = current) => NUMBER_TAG[l];

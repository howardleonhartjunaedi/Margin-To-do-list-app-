"use client";

import { catalogs } from "./catalogs";
import { useLocale } from "./context";

export { I18nProvider, useLocale } from "./context";

/** The current language's strings: `const t = useT(); t.nav.inbox`. */
export const useT = () => catalogs[useLocale()];

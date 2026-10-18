"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { catalogs } from "@/i18n/catalogs";
import { rememberedLocale } from "@/i18n/cookie";
import { DEFAULT_LOCALE, isLocale, matchLocale, type Locale } from "@/i18n/locales";

/** The page is cached once for everyone, so it picks its language on the device. */
export function OfflineMessage() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    const chosen = rememberedLocale();
    const l = isLocale(chosen) ? chosen : matchLocale(navigator.languages);
    setLocale(l);
    document.documentElement.lang = l;
  }, []);
  const t = catalogs[locale].offline;
  return (
    <>
      <h1 className="mt-10 font-display text-4xl text-ink">{t.title}</h1>
      <p className="mt-3 text-base text-ink-2">{t.body}</p>
      <div className="mt-8">
        <Button variant="primary" onClick={() => location.reload()}>
          {t.retry}
        </Button>
      </div>
    </>
  );
}

"use client";

import { useLocale } from "@/i18n/context";
import { rememberLocale } from "@/i18n/cookie";
import { LOCALE_NAMES, LOCALES } from "@/i18n/locales";
import { cn } from "@/lib/cn";

/** Picks the front page's language, and remembers it for sign-in and sign-up on this device. */
export function LanguageSwitch({ label }: { label: string }) {
  const current = useLocale();
  return (
    <nav aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {LOCALES.map((l) => (
        <a
          key={l}
          href={`/${l}`}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          onClick={() => rememberLocale(l)}
          className={cn(l === current ? "text-ink" : "text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink")}
        >
          {LOCALE_NAMES[l]}
        </a>
      ))}
    </nav>
  );
}

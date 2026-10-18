import type { Locale } from "./locales";

/** Same name as LOCALE_COOKIE in ./server (kept apart so client code doesn't import server modules). */
const NAME = "margin-locale";

/** Remember this device's language for pages before sign-in. null = follow the browser again. */
export function rememberLocale(locale: Locale | null) {
  document.cookie = locale ? `${NAME}=${locale}; path=/; max-age=31536000; samesite=lax` : `${NAME}=; path=/; max-age=0; samesite=lax`;
}

export function rememberedLocale(): string | null {
  return document.cookie.match(new RegExp(`(?:^|; )${NAME}=([^;]*)`))?.[1] ?? null;
}

import "server-only";
import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import type { Messages } from "./catalogs";
import { isLocale, matchLocale, type Locale } from "./locales";

export const LOCALE_COOKIE = "margin-locale";

/**
 * The language for a request: the account's choice if given, else this device's (cookie, set
 * when someone picks a language), else the browser's Accept-Language.
 */
export async function requestLocale(accountChoice?: string | null): Promise<Locale> {
  if (isLocale(accountChoice)) return accountChoice;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return matchLocale((await headers()).get("accept-language"));
}

/** The strings for this request's language, for server components. */
export async function serverT(accountChoice?: string | null) {
  const { catalogs } = await import("./catalogs");
  return catalogs[await requestLocale(accountChoice)];
}

/** Page metadata with a title in the request's language. */
export function localizedTitle(pick: (t: Messages) => string) {
  return async (): Promise<Metadata> => ({ title: pick(await serverT()) });
}

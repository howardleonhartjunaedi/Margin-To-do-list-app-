import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALES, matchLocale } from "@/i18n/locales";

/*
 * Optimistic routing on the session cookie only (no DB hit here).
 * The (app) layout does the real session check.
 */

const APP = ["/today", "/inbox", "/upcoming", "/project", "/settings", "/filter", "/focus", "/habits", "/stats", "/plan", "/review"];
const AUTH = ["/sign-in", "/sign-up"];
const FRONT = ["/", ...LOCALES.map((l) => `/${l}`)];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = Boolean(getSessionCookie(req));

  if (!signedIn && APP.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Signed-in users go straight to Today. `reauth` means the cookie exists but the
  // session behind it is gone (the app layout sent us here) — let them sign in.
  if (signedIn && !req.nextUrl.searchParams.has("reauth") && (FRONT.includes(pathname) || AUTH.includes(pathname))) {
    const next = req.nextUrl.searchParams.get("next");
    // Only same-site paths: never bounce to another origin ("//evil.com" is protocol-relative).
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/today";
    const res = NextResponse.redirect(new URL(safe, req.url));
    // If the cookie turns out to be stale, /session-ended brings a front-page visitor back here.
    if (FRONT.includes(pathname)) res.cookies.set("margin-from-front", "1", { path: "/", maxAge: 10, httpOnly: true, sameSite: "lax" });
    return res;
  }
  // The front page is prerendered once per language; "/" shows the visitor's, keeping the URL.
  if (pathname === "/") {
    const chosen = req.cookies.get("margin-locale")?.value;
    const locale = isLocale(chosen) ? chosen : matchLocale(req.headers.get("accept-language"));
    return NextResponse.rewrite(new URL(`/${locale}${req.nextUrl.search}`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/en", "/id", "/sign-in", "/sign-up", "/today", "/inbox", "/upcoming", "/project/:path*", "/settings", "/filter/:path*", "/focus", "/habits", "/stats", "/plan", "/review"],
};

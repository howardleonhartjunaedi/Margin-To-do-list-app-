import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Optimistic routing on the session cookie only (no DB hit here).
 * The (app) layout does the real session check.
 */

const APP = ["/today", "/inbox", "/upcoming", "/project", "/settings", "/filter", "/focus", "/habits", "/stats", "/plan", "/review"];
const AUTH = ["/sign-in", "/sign-up"];

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
  if (signedIn && !req.nextUrl.searchParams.has("reauth") && (pathname === "/" || AUTH.includes(pathname))) {
    return NextResponse.redirect(new URL("/today", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/sign-in", "/sign-up", "/today", "/inbox", "/upcoming", "/project/:path*", "/settings", "/filter/:path*", "/focus", "/habits", "/stats", "/plan", "/review"],
};

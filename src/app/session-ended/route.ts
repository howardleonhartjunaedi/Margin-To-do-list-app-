import { NextResponse, type NextRequest } from "next/server";

/*
 * Where the app sends a browser whose session cookie outlived its session (signed out
 * elsewhere, expired, database reset). It clears the dead cookies, so the proxy stops
 * treating the visitor as signed in, then shows what they were after: the front page if
 * that's where they started (proxy.ts marks it), otherwise sign-in.
 */
export function GET(req: NextRequest) {
  const fromFront = req.cookies.has(FRONT_MARK);
  const next = req.nextUrl.searchParams.get("next");
  let target = fromFront ? "/" : "/sign-in?reauth=1";
  if (!fromFront && next?.startsWith("/") && !next.startsWith("//")) target += `&next=${encodeURIComponent(next)}`;

  // A relative Location keeps the host the browser used (req.url can name the server's own).
  const res = new NextResponse(null, { status: 307, headers: { Location: target } });
  for (const { name } of req.cookies.getAll()) {
    // __Secure- cookies can only be overwritten by a Secure cookie.
    if (name.replace(/^__Secure-/, "").startsWith("better-auth.")) res.cookies.set(name, "", { path: "/", maxAge: 0, secure: name.startsWith("__Secure-") });
  }
  res.cookies.delete(FRONT_MARK);
  return res;
}

const FRONT_MARK = "margin-from-front";

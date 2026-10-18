import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { db, dbReady, schema } from "./db";
import { siteUrl } from "./site";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, rateLimit: schema.rateLimit },
  }),
  baseURL: siteUrl() || undefined,
  // In the database, so the limit holds across server instances (and restarts).
  rateLimit: { storage: "database" },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getSession = cache(async () => {
  const h = await headers(); // first: marks the page dynamic before any DB access
  await dbReady();
  return auth.api.getSession({ headers: h });
});

/** For route handlers: the user id, or a 401 Response to return. */
export async function requireUserId(req: Request): Promise<string | Response> {
  await dbReady();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  return session.user.id;
}

/*
 * Facts about where this server runs, fixed at build time by next.config.ts (env).
 * Outside a Next build (the worker, tests) the inlined values are absent and the defaults apply.
 */

/** Serverless host (Netlify): no long-lived process, no writable disk, many short-lived instances. */
export const SERVERLESS = process.env.MARGIN_SERVERLESS === "1";

/** Look-only build with no database: the front page works, accounts don't exist. */
export const PREVIEW = process.env.MARGIN_PREVIEW === "1";

/** The public origin, without a trailing slash: BETTER_AUTH_URL, else the one the host assigned. */
export const siteUrl = () => (process.env.BETTER_AUTH_URL ?? process.env.MARGIN_SITE_URL ?? "").replace(/\/$/, "");

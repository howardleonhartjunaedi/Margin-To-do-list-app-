import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Webhook signatures, Stripe-style:
 *   X-Margin-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
 * Receivers recompute the HMAC over the raw body and reject stale timestamps (replays).
 */

export function sign(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

/** Verify a signature header. `toleranceSec` bounds how old a delivery may be. */
export function verify(secret: string, body: string, header: string, now = Math.floor(Date.now() / 1000), toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(now - t) > toleranceSec) return false;
  const expected = Buffer.from(sign(secret, body, t).split("v1=")[1], "hex");
  const given = Buffer.from(parts.v1, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Wait before retry n (1-based): 30s, 1m, 2m, 4m, 8m, 16m. */
export const backoffMs = (attempt: number) => 30_000 * 2 ** (attempt - 1);
export const MAX_ATTEMPTS = 6;
/** Consecutive failed deliveries before an endpoint is switched off. */
export const DISABLE_AFTER = 20;

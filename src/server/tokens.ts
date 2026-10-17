import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "./db";
import { apiToken } from "./db/schema";
import { ClientError } from "./errors";

/*
 * Personal access tokens: "mgn_" + 32 random bytes. Only the SHA-256 is stored;
 * the token itself is shown once, at creation.
 */

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createToken(userId: string, name: string) {
  const token = `mgn_${randomBytes(32).toString("base64url")}`;
  const [row] = await db
    .insert(apiToken)
    .values({ userId, name, prefix: token.slice(0, 12), tokenHash: hashToken(token) })
    .returning({ id: apiToken.id, name: apiToken.name, prefix: apiToken.prefix, createdAt: apiToken.createdAt });
  return { ...row, createdAt: row.createdAt.toISOString(), token };
}

export async function listTokens(userId: string) {
  const rows = await db
    .select({ id: apiToken.id, name: apiToken.name, prefix: apiToken.prefix, createdAt: apiToken.createdAt, lastUsedAt: apiToken.lastUsedAt })
    .from(apiToken)
    .where(and(eq(apiToken.userId, userId), isNull(apiToken.revokedAt)))
    .orderBy(desc(apiToken.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null }));
}

export async function revokeToken(userId: string, id: string) {
  const rows = await db
    .update(apiToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiToken.id, id), eq(apiToken.userId, userId), isNull(apiToken.revokedAt)))
    .returning({ id: apiToken.id });
  if (!rows.length) throw new ClientError("That token doesn’t exist.", 404);
}

/** The user behind a bearer token, or null. Touches lastUsedAt at most once a minute. */
export async function userForToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!token.startsWith("mgn_") || token.length > 100) return null;
  const [row] = await db
    .select({ id: apiToken.id, userId: apiToken.userId })
    .from(apiToken)
    .where(and(eq(apiToken.tokenHash, hashToken(token)), isNull(apiToken.revokedAt)));
  if (!row) return null;
  const minuteAgo = new Date(Date.now() - 60_000);
  await db
    .update(apiToken)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(apiToken.id, row.id), or(isNull(apiToken.lastUsedAt), lt(apiToken.lastUsedAt, minuteAgo))));
  return { userId: row.userId, tokenId: row.id };
}

/* ---- Rate limit: fixed window per token, in memory (per server process). ---- */

export const RATE_LIMIT = 120; // requests per minute
const windows = new Map<string, { start: number; count: number }>();

/** Returns seconds to wait if over the limit, else null. */
export function rateLimited(key: string, now = Date.now()): number | null {
  const w = windows.get(key);
  if (!w || now - w.start >= 60_000) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) for (const [k, v] of windows) if (now - v.start >= 60_000) windows.delete(k);
    return null;
  }
  w.count++;
  return w.count > RATE_LIMIT ? Math.ceil((w.start + 60_000 - now) / 1000) : null;
}

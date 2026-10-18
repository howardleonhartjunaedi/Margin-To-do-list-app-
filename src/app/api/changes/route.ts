import { db } from "@/server/db";
import { changesSince, latestChange } from "@/server/events";
import { authenticate } from "@/server/http";

/**
 * Change notices for tabs that poll instead of holding a stream (REALTIME=poll).
 * Without `since`: just the current cursor, to start from. With it: what happened after,
 * oldest first; `more` means there was too much to list and the tab should refresh everything.
 */
export async function GET(req: Request) {
  const who = await authenticate(req);
  if (who instanceof Response) return who;

  const since = Number(new URL(req.url).searchParams.get("since"));
  const headers = { "cache-control": "no-store" };
  if (!Number.isSafeInteger(since) || since < 0 || !new URL(req.url).searchParams.has("since"))
    return Response.json({ cursor: await latestChange(db, who.userId), events: [], more: false }, { headers });

  const LIMIT = 200;
  const rows = await changesSince(db, who.userId, since, LIMIT);
  return Response.json({ cursor: rows.at(-1)?.cursor ?? since, events: rows.map((r) => r.event), more: rows.length === LIMIT }, { headers });
}

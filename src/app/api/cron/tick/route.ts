import { timingSafeEqual } from "node:crypto";
import { db, dbReady } from "@/server/db";
import { tickOnce } from "@/server/scheduler/start";

/*
 * One scheduler pass, for hosts with no long-lived process to run it (netlify/functions/tick.mts
 * calls this every minute). Needs CRON_SECRET; without it the endpoint doesn't exist.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "Not allowed." }, { status: 401 });

  await dbReady();
  const { reminders, webhooks } = await tickOnce(db, undefined, "cron");
  return Response.json({ reminders, webhooks });
}

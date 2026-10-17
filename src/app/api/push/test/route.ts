import { db } from "@/server/db";
import { route } from "@/server/http";
import { realChannels } from "@/server/scheduler/channels";
import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/** Sends a test push to every device the user has subscribed. */
export const POST = route(async (_req, userId) => {
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  await realChannels(db).push({
    userId,
    email: u.email,
    title: "Reminders are on",
    body: "This is what a reminder looks like on this device.",
    url: "/today",
    tag: "test",
  });
  return { ok: true };
});

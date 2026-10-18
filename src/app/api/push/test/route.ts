import { db } from "@/server/db";
import { route } from "@/server/http";
import { realChannels } from "@/server/scheduler/channels";
import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { m } from "@/i18n/catalogs";
import { isLocale, type Locale } from "@/i18n/locales";
import { getSettings } from "@/server/reminders";

/** Sends a test push to every device the user has subscribed. */
export const POST = route(async (_req, userId) => {
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  const s = await getSettings(db, userId);
  const words = m(isLocale(s.locale) ? s.locale : "en").email;
  await realChannels(db).push({
    userId,
    email: u.email,
    title: words.pushTestTitle,
    body: words.pushTestBody,
    url: "/today",
    tag: "test",
  });
  return { ok: true };
});

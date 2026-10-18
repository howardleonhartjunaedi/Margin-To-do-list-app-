import { z } from "zod";
import { triageInbox } from "@/server/ai";
import { body, route } from "@/server/http";

/** { locale? } → { suggestions: [{ taskId, title, projectId, projectName, dueDate, priority, reason }] }. Nothing is saved. */
export const POST = route(async (req, userId) => {
  const { locale } = z.object({ locale: z.string().optional() }).parse(await body(req).catch(() => ({})));
  return triageInbox(userId, locale);
});

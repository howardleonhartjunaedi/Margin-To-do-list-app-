import { z } from "zod";
import { breakdownTask } from "@/server/ai";
import { body, route } from "@/server/http";

/** { taskId } → { steps: [{ title, estimateMinutes }] }. Suggestions only; nothing is saved. */
export const POST = route(async (req, userId) => {
  const { taskId, locale } = z.object({ taskId: z.string().min(1), locale: z.string().optional() }).parse(await body(req));
  return breakdownTask(userId, taskId, locale);
});

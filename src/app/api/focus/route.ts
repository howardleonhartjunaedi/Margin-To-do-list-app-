import { body, route } from "@/server/http";
import { recordFocus } from "@/server/productivity";
import { focusSessionSchema } from "@/lib/validation";

/** Record a finished (or stopped) focus or break interval. The running timer lives on the client. */
export const POST = route(async (req, userId) => {
  const s = focusSessionSchema.parse(await body(req));
  return Response.json(await recordFocus(userId, s), { status: 201 });
});

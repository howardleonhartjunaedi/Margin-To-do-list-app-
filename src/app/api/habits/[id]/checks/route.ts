import { body, route } from "@/server/http";
import { setHabitCheck } from "@/server/productivity";
import { habitCheckSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** { date, done } — idempotent, so retries and double taps are safe. */
export const PUT = route<Ctx>(async (req, userId, { params }) => {
  const { date, done } = habitCheckSchema.parse(await body(req));
  await setHabitCheck(userId, (await params).id, date, done);
  return { ok: true };
});

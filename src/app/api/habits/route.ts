import { body, route } from "@/server/http";
import { createHabit, listHabits } from "@/server/productivity";
import { habitSchema } from "@/lib/validation";

export const GET = route(async (_req, userId) => listHabits(userId));

export const POST = route(async (req, userId) => {
  await createHabit(userId, habitSchema.parse(await body(req)));
  return Response.json(await listHabits(userId), { status: 201 });
});

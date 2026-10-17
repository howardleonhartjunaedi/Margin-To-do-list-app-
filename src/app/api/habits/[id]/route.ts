import { body, route } from "@/server/http";
import { deleteHabit, listHabits, updateHabit } from "@/server/productivity";
import { habitPatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, userId, { params }) => {
  await updateHabit(userId, (await params).id, habitPatchSchema.parse(await body(req)));
  return listHabits(userId);
});

export const DELETE = route<Ctx>(async (_req, userId, { params }) => {
  await deleteHabit(userId, (await params).id);
  return { ok: true };
});

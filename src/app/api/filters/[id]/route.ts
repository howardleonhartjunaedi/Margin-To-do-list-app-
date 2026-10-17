import { body, route } from "@/server/http";
import { deleteFilter, updateFilter } from "@/server/tasks";
import { savedFilterSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, userId, { params }) =>
  updateFilter(userId, (await params).id, savedFilterSchema.omit({ id: true }).partial().parse(await body(req))),
);

export const DELETE = route<Ctx>(async (_req, userId, { params }) => {
  await deleteFilter(userId, (await params).id);
  return { ok: true };
});

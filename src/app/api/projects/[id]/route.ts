import { body, route } from "@/server/http";
import { deleteProject, updateProject } from "@/server/tasks";
import { updateProjectSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, userId, { params }) =>
  updateProject(userId, (await params).id, updateProjectSchema.parse(await body(req))),
);

/** Permanent. The UI confirms first and offers Archive instead. */
export const DELETE = route<Ctx>(async (_req, userId, { params }) => {
  await deleteProject(userId, (await params).id);
  return { ok: true };
});

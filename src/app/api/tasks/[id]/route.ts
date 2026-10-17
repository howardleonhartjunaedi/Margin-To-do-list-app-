import { body, route } from "@/server/http";
import { getTaskWithSubtasks, updateTask } from "@/server/tasks";
import { updateTaskSchema } from "@/lib/validation";
import { listReminders } from "@/server/notify";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, userId, { params }) => {
  const { id } = await params;
  const detail = await getTaskWithSubtasks(userId, id);
  return { ...detail, reminders: await listReminders(userId, id) };
});

export const PATCH = route<Ctx>(async (req, userId, { params }) =>
  updateTask(userId, (await params).id, updateTaskSchema.parse(await body(req))),
);

/** Soft delete — restorable with PATCH { deleted: false } (that's what Undo does). */
export const DELETE = route<Ctx>(async (_req, userId, { params }) => updateTask(userId, (await params).id, { deleted: true }));

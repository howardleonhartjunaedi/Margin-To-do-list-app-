import { body, route } from "@/server/http";
import { getTaskWithSubtasks, updateTask } from "@/server/tasks";
import { updateTaskSchema } from "@/lib/validation";
import { listReminders } from "@/server/notify";
import { focusForTask } from "@/server/productivity";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, userId, { params }) => {
  const { id } = await params;
  const detail = await getTaskWithSubtasks(userId, id);
  const [reminders, focus] = await Promise.all([listReminders(userId, id), focusForTask(userId, id)]);
  return { ...detail, reminders, focus };
});

export const PATCH = route<Ctx>(async (req, userId, { params }) =>
  updateTask(userId, (await params).id, updateTaskSchema.parse(await body(req))),
);

/** Soft delete — restorable with PATCH { deleted: false } (that's what Undo does). */
export const DELETE = route<Ctx>(async (_req, userId, { params }) => updateTask(userId, (await params).id, { deleted: true }));

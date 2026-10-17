import { db } from "@/server/db";
import { route } from "@/server/http";
import { deleteReminder } from "@/server/reminders";
import { ClientError } from "@/server/tasks";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (_req, userId, { params }) => {
  if (!(await deleteReminder(db, userId, (await params).id))) throw new ClientError("That reminder doesn’t exist any more.", 404);
  return { ok: true };
});

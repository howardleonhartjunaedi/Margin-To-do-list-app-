import { body, route } from "@/server/http";
import { createReminder, listReminders } from "@/server/notify";
import { createReminderSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, userId, { params }) => listReminders(userId, (await params).id));

export const POST = route<Ctx>(async (req, userId, { params }) => {
  const { id } = await params;
  await createReminder(userId, id, createReminderSchema.parse(await body(req)));
  return Response.json(await listReminders(userId, id), { status: 201 });
});

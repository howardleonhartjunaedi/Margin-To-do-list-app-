import { body, route } from "@/server/http";
import { createTask, listTasks } from "@/server/tasks";
import { createTaskSchema, viewQuerySchema } from "@/lib/validation";

export const GET = route(async (req, userId) => {
  const q = viewQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return listTasks(userId, q);
});

export const POST = route(async (req, userId) => {
  const task = await createTask(userId, createTaskSchema.parse(await body(req)));
  return Response.json(task, { status: 201 });
});

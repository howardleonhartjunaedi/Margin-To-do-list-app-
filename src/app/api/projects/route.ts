import { body, route } from "@/server/http";
import { createProject, listProjects } from "@/server/tasks";
import { createProjectSchema } from "@/lib/validation";

export const GET = route(async (_req, userId) => listProjects(userId));

export const POST = route(async (req, userId) => {
  const project = await createProject(userId, createProjectSchema.parse(await body(req)));
  return Response.json(project, { status: 201 });
});

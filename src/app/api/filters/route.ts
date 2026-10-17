import { body, route } from "@/server/http";
import { createFilter, listFilters } from "@/server/tasks";
import { savedFilterSchema } from "@/lib/validation";

export const GET = route(async (_req, userId) => listFilters(userId));

export const POST = route(async (req, userId) => {
  const f = await createFilter(userId, savedFilterSchema.parse(await body(req)));
  return Response.json(f, { status: 201 });
});

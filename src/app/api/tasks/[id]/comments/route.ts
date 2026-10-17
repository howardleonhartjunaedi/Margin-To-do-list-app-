import { body, route } from "@/server/http";
import { addComment, listComments } from "@/server/comments";
import { commentSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, userId, { params }) => listComments(userId, (await params).id));

export const POST = route<Ctx>(async (req, userId, { params }) => {
  const { body: text } = commentSchema.parse(await body(req));
  return Response.json(await addComment(userId, (await params).id, text), { status: 201 });
});

import { body, route } from "@/server/http";
import { deleteComment, editComment } from "@/server/comments";
import { commentSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, userId, { params }) => {
  const { body: text } = commentSchema.parse(await body(req));
  await editComment(userId, (await params).id, text);
  return { ok: true };
});

export const DELETE = route<Ctx>(async (_req, userId, { params }) => {
  await deleteComment(userId, (await params).id);
  return { ok: true };
});

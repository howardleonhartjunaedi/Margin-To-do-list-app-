import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Comment } from "@/lib/types";
import { audienceForTask, requireTaskRole } from "./access";
import { db } from "./db";
import { comment, notification, user } from "./db/schema";
import { ClientError } from "./errors";
import { emit } from "./events";

const columns = {
  id: comment.id,
  taskId: comment.taskId,
  userId: comment.userId,
  authorName: user.name,
  body: comment.body,
  createdAt: comment.createdAt,
  editedAt: comment.editedAt,
};

const toComment = (r: { id: string; taskId: string; userId: string; authorName: string; body: string; createdAt: Date; editedAt: Date | null }): Comment => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  editedAt: r.editedAt?.toISOString() ?? null,
});

export async function listComments(userId: string, taskId: string) {
  await requireTaskRole(db, userId, taskId, "viewer");
  const rows = await db
    .select(columns)
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .where(and(eq(comment.taskId, taskId), isNull(comment.deletedAt)))
    .orderBy(asc(comment.createdAt));
  return rows.map(toComment);
}

export async function addComment(userId: string, taskId: string, body: string) {
  const access = await requireTaskRole(db, userId, taskId, "commenter");
  const [row] = await db.insert(comment).values({ taskId, userId, body }).returning({ id: comment.id });
  const [c] = await db.select(columns).from(comment).innerJoin(user, eq(user.id, comment.userId)).where(eq(comment.id, row.id));
  const created = toComment(c);

  // Tell the people who care: whoever added the task and whoever it's assigned to — not the author.
  const notify = [...new Set([access.task.userId, access.task.assigneeId].filter((u): u is string => !!u && u !== userId))];
  if (notify.length) {
    const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;
    await db.insert(notification).values(notify.map((u) => ({ userId: u, taskId, kind: "comment", title: access.task.title, body: `${created.authorName}: ${preview}` })));
    await emit(db, notify, { type: "notification" });
  }
  await emit(db, await audienceForTask(db, access.task), { type: "comment", taskId, projectId: access.task.projectId }, { event: "comment.created", data: { comment: created, task: { id: taskId, title: access.task.title, projectId: access.task.projectId } } });
  return created;
}

async function ownComment(userId: string, id: string) {
  const [c] = await db.select({ userId: comment.userId, taskId: comment.taskId }).from(comment).where(and(eq(comment.id, id), isNull(comment.deletedAt)));
  if (!c) throw new ClientError("That comment doesn’t exist any more.", 404);
  const access = await requireTaskRole(db, userId, c.taskId, "viewer");
  return { ...c, access };
}

export async function editComment(userId: string, id: string, body: string) {
  const c = await ownComment(userId, id);
  if (c.userId !== userId) throw new ClientError("You can only edit your own comments.", 403);
  await db.update(comment).set({ body, editedAt: new Date() }).where(eq(comment.id, id));
  await emit(db, await audienceForTask(db, c.access.task), { type: "comment", taskId: c.taskId });
}

/** Your own comments, or any comment if you own the project. */
export async function deleteComment(userId: string, id: string) {
  const c = await ownComment(userId, id);
  if (c.userId !== userId && c.access.role !== "owner") throw new ClientError("You can only delete your own comments.", 403);
  await db.update(comment).set({ deletedAt: new Date() }).where(eq(comment.id, id));
  await emit(db, await audienceForTask(db, c.access.task), { type: "comment", taskId: c.taskId });
}

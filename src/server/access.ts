import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "./db/types";
import { projectMember, task } from "./db/schema";
import { ClientError } from "./errors";

/*
 * Who can see and change what. Every task query goes through these predicates.
 *
 *   A task is visible to you if it's in your Inbox (no project, you created it),
 *   or it's in a project you're a member of.
 *
 *   Roles, per project:  viewer < commenter < editor < owner
 *   Inbox tasks behave as if you were the owner.
 */

export type Role = "viewer" | "commenter" | "editor" | "owner";
export const ROLES: Role[] = ["viewer", "commenter", "editor", "owner"];
const rank = (r: Role) => ROLES.indexOf(r);
export const atLeast = (r: Role | null, min: Role) => r !== null && rank(r) >= rank(min);

// Written against the qualified column so it binds to the outer task row in any context.
const TASK_PROJECT = sql.raw('"task"."project_id"');

/** SQL: tasks `userId` may see. */
export const visibleTask = (userId: string) =>
  or(
    and(isNull(task.projectId), eq(task.userId, userId)),
    sql`exists (select 1 from project_member pm where pm.project_id = ${TASK_PROJECT} and pm.user_id = ${userId})`,
  );

/**
 * SQL: tasks that belong on `userId`'s own date views (Today, Upcoming, calendar of
 * everything): assigned to them, or unassigned and created by them. Keeps a big shared
 * project from flooding everyone's Today.
 */
export const forMe = (userId: string) =>
  or(eq(task.assigneeId, userId), and(isNull(task.assigneeId), eq(task.userId, userId)));

export async function projectRole(db: Db, userId: string, projectId: string): Promise<Role | null> {
  const [m] = await db
    .select({ role: projectMember.role })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)));
  return (m?.role as Role) ?? null;
}

export async function requireProjectRole(db: Db, userId: string, projectId: string, min: Role) {
  const role = await projectRole(db, userId, projectId);
  if (!role) throw new ClientError("That project doesn’t exist.", 404);
  if (!atLeast(role, min)) throw new ClientError(deniedMessage(min), 403);
  return role;
}

export interface TaskAccess {
  role: Role;
  task: { id: string; userId: string; projectId: string | null; parentId: string | null; assigneeId: string | null; title: string };
}

/** Your role on a task, or null if you can't see it (deleted tasks are still reachable, for Undo). */
export async function taskAccess(db: Db, userId: string, taskId: string): Promise<TaskAccess | null> {
  const [t] = await db
    .select({ id: task.id, userId: task.userId, projectId: task.projectId, parentId: task.parentId, assigneeId: task.assigneeId, title: task.title })
    .from(task)
    .where(eq(task.id, taskId));
  if (!t) return null;
  if (!t.projectId) return t.userId === userId ? { role: "owner", task: t } : null;
  const role = await projectRole(db, userId, t.projectId);
  return role ? { role, task: t } : null;
}

export async function requireTaskRole(db: Db, userId: string, taskId: string, min: Role): Promise<TaskAccess> {
  const a = await taskAccess(db, userId, taskId);
  if (!a) throw new ClientError("That task doesn’t exist any more.", 404);
  if (!atLeast(a.role, min)) throw new ClientError(deniedMessage(min), 403);
  return a;
}

function deniedMessage(min: Role) {
  return min === "owner"
    ? "Only the project’s owner can do that."
    : min === "editor"
      ? "You can view this project but not change it. Ask the owner for edit access."
      : "You can view this project but not comment. Ask the owner for access.";
}

/** Everyone who should hear about a change to a task: project members, or the Inbox owner. */
export async function audienceForTask(db: Db, t: { userId: string; projectId: string | null }): Promise<string[]> {
  if (!t.projectId) return [t.userId];
  const rows = await db.select({ userId: projectMember.userId }).from(projectMember).where(eq(projectMember.projectId, t.projectId));
  return rows.map((r) => r.userId);
}

export async function audienceForProject(db: Db, projectId: string): Promise<string[]> {
  const rows = await db.select({ userId: projectMember.userId }).from(projectMember).where(eq(projectMember.projectId, projectId));
  return rows.map((r) => r.userId);
}

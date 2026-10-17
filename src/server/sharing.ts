import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { Member, Role } from "@/lib/types";
import { audienceForProject, projectRole, requireProjectRole } from "./access";
import { db } from "./db";
import { project, projectInvite, projectMember, task, user } from "./db/schema";
import { ClientError } from "./errors";
import { emit } from "./events";
import { realChannels } from "./scheduler/channels";

const INVITE_DAYS = 14;
const baseUrl = () => process.env.BETTER_AUTH_URL ?? "";

export async function listMembers(userId: string, projectId: string) {
  const myRole = await requireProjectRole(db, userId, projectId, "viewer");
  const members: Member[] = (
    await db
      .select({ userId: projectMember.userId, name: user.name, email: user.email, role: projectMember.role })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      .where(eq(projectMember.projectId, projectId))
      .orderBy(asc(projectMember.createdAt))
  ).map((m) => ({ ...m, role: m.role as Role }));
  const invites =
    myRole === "owner"
      ? (
          await db
            .select({ id: projectInvite.id, email: projectInvite.email, role: projectInvite.role, expiresAt: projectInvite.expiresAt })
            .from(projectInvite)
            .where(and(eq(projectInvite.projectId, projectId), isNull(projectInvite.acceptedAt), gt(projectInvite.expiresAt, new Date())))
            .orderBy(asc(projectInvite.createdAt))
        ).map((i) => ({ id: i.id, email: i.email, role: i.role as Role, expiresAt: i.expiresAt.toISOString(), url: `${baseUrl()}/invite/${i.id}` }))
      : [];
  return { myRole, members, invites };
}

export async function createInvite(userId: string, projectId: string, input: { email?: string | null; role: Exclude<Role, "owner"> }) {
  await requireProjectRole(db, userId, projectId, "owner");
  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .innerJoin(projectMember, and(eq(projectMember.userId, user.id), eq(projectMember.projectId, projectId)))
      .where(eq(user.email, email));
    if (existing) throw new ClientError("They’re already a member of this project.", 422);
  }
  const id = randomBytes(24).toString("base64url");
  await db.insert(projectInvite).values({
    id,
    projectId,
    email,
    role: input.role,
    invitedBy: userId,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });
  const url = `${baseUrl()}/invite/${id}`;
  if (email) {
    const [[inviter], [p]] = await Promise.all([
      db.select({ name: user.name }).from(user).where(eq(user.id, userId)),
      db.select({ name: project.name }).from(project).where(eq(project.id, projectId)),
    ]);
    await realChannels(db)
      .email({
        userId,
        email,
        title: `${inviter?.name ?? "Someone"} invited you to “${p?.name}”`,
        body: `You’ve been invited to join the project “${p?.name}” on Margin as ${article(input.role)} ${input.role}.\nThe link works for ${INVITE_DAYS} days.`,
        url,
        tag: `invite-${id.slice(0, 8)}`,
        footer: "You got this because someone invited you to a project on Margin. Ignore it if it’s not for you.",
      })
      .catch((e) => console.error("[invite] email", e));
  }
  return { id, url, email, role: input.role };
}

const article = (r: string) => (/^[aeiou]/.test(r) ? "an" : "a");

export async function revokeInvite(userId: string, inviteId: string) {
  const [inv] = await db.select({ projectId: projectInvite.projectId }).from(projectInvite).where(eq(projectInvite.id, inviteId));
  if (!inv) throw new ClientError("That invitation doesn’t exist.", 404);
  await requireProjectRole(db, userId, inv.projectId, "owner");
  await db.delete(projectInvite).where(eq(projectInvite.id, inviteId));
}

/** What the invite page shows. Safe to call signed out: reveals only the project name and inviter. */
export async function describeInvite(token: string) {
  const [row] = await db
    .select({
      projectId: projectInvite.projectId,
      projectName: project.name,
      inviter: user.name,
      email: projectInvite.email,
      role: projectInvite.role,
      expiresAt: projectInvite.expiresAt,
      acceptedAt: projectInvite.acceptedAt,
    })
    .from(projectInvite)
    .innerJoin(project, eq(project.id, projectInvite.projectId))
    .innerJoin(user, eq(user.id, projectInvite.invitedBy))
    .where(eq(projectInvite.id, token));
  if (!row) return null;
  const status = row.acceptedAt ? "used" : row.expiresAt < new Date() ? "expired" : "open";
  return { ...row, role: row.role as Role, status } as const;
}

export async function acceptInvite(userId: string, userEmail: string, token: string) {
  const inv = await describeInvite(token);
  if (!inv) throw new ClientError("That invitation doesn’t exist. Ask for a new link.", 404);
  if (inv.status === "expired") throw new ClientError("That invitation has expired. Ask for a new link.", 410);
  const current = await projectRole(db, userId, inv.projectId);
  if (inv.status === "used" && !current) throw new ClientError("That invitation has already been used. Ask for a new link.", 410);
  if (inv.email && inv.email !== userEmail.toLowerCase())
    throw new ClientError(`This invitation was sent to ${inv.email}. Sign in with that address to accept it.`, 403);
  // Already a member: just let them through, and leave the link for whoever it was meant for.
  if (current) return { projectId: inv.projectId };
  await db.insert(projectMember).values({ projectId: inv.projectId, userId, role: inv.role });
  await db.update(projectInvite).set({ acceptedAt: new Date(), acceptedBy: userId }).where(and(eq(projectInvite.id, token), isNull(projectInvite.acceptedAt)));
  await emit(db, await audienceForProject(db, inv.projectId), { type: "members", projectId: inv.projectId });
  return { projectId: inv.projectId };
}

export async function setMemberRole(userId: string, projectId: string, memberId: string, role: Exclude<Role, "owner">) {
  await requireProjectRole(db, userId, projectId, "owner");
  const current = await projectRole(db, memberId, projectId);
  if (!current) throw new ClientError("They’re not a member of this project.", 404);
  if (current === "owner") throw new ClientError("The owner’s role can’t be changed.", 422);
  await db.update(projectMember).set({ role }).where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, memberId)));
  await emit(db, await audienceForProject(db, projectId), { type: "members", projectId });
}

/** The owner removes someone, or a member leaves. The owner can't leave their own project. */
export async function removeMember(userId: string, projectId: string, memberId: string) {
  const myRole = await requireProjectRole(db, userId, projectId, memberId === userId ? "viewer" : "owner");
  if (memberId === userId && myRole === "owner") throw new ClientError("You own this project. Delete it instead, or keep it.", 422);
  const audience = await audienceForProject(db, projectId);
  await db.delete(projectMember).where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, memberId)));
  // Their assignments in this project go back to unassigned.
  await db.update(task).set({ assigneeId: null }).where(and(eq(task.projectId, projectId), eq(task.assigneeId, memberId)));
  await emit(db, audience, { type: "members", projectId });
}

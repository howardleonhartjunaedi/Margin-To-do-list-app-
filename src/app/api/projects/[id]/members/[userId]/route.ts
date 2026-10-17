import { z } from "zod";
import { body, route } from "@/server/http";
import { listMembers, removeMember, setMemberRole } from "@/server/sharing";
import { memberRole } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export const PATCH = route<Ctx>(async (req, me, { params }) => {
  const { id, userId } = await params;
  const { role } = z.object({ role: memberRole }).parse(await body(req));
  await setMemberRole(me, id, userId, role);
  return listMembers(me, id);
});

/** Remove a member (owner), or leave (yourself). */
export const DELETE = route<Ctx>(async (_req, me, { params }) => {
  const { id, userId } = await params;
  await removeMember(me, id, userId);
  return { ok: true };
});

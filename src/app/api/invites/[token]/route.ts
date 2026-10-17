import { route } from "@/server/http";
import { revokeInvite } from "@/server/sharing";

type Ctx = { params: Promise<{ token: string }> };

export const DELETE = route<Ctx>(async (_req, userId, { params }) => {
  await revokeInvite(userId, (await params).token);
  return { ok: true };
});

import { route } from "@/server/http";
import { revokeToken } from "@/server/tokens";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(
  async (_req, userId, { params }) => {
    await revokeToken(userId, (await params).id);
    return { ok: true };
  },
  { sessionOnly: true },
);

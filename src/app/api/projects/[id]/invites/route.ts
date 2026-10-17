import { body, route } from "@/server/http";
import { createInvite } from "@/server/sharing";
import { inviteSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** { email?, role } — with an email it's sent and bound to that address; without, it's a single-use link. */
export const POST = route<Ctx>(async (req, userId, { params }) => {
  const input = inviteSchema.parse(await body(req));
  return Response.json(await createInvite(userId, (await params).id, input), { status: 201 });
});

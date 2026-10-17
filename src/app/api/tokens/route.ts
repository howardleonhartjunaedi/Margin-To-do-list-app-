import { z } from "zod";
import { body, route } from "@/server/http";
import { createToken, listTokens } from "@/server/tokens";

export const GET = route(async (_req, userId) => listTokens(userId), { sessionOnly: true });

/** Returns the token once. Only its hash is kept. */
export const POST = route(
  async (req, userId) => {
    const { name } = z.object({ name: z.string().trim().min(1, "Give the token a name.").max(60) }).parse(await body(req));
    return Response.json(await createToken(userId, name), { status: 201 });
  },
  { sessionOnly: true },
);

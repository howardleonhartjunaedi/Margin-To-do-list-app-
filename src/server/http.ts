import "server-only";
import { z } from "zod";
import { requireUserId } from "./auth";
import { ClientError } from "./tasks";

type Handler<C> = (req: Request, userId: string, ctx: C) => Promise<unknown>;

/**
 * Wraps a route handler: authenticates, runs it, and maps errors to JSON with
 * a human message. Every query inside is scoped by the userId passed in.
 */
export function route<C = unknown>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    const userId = await requireUserId(req);
    if (userId instanceof Response) return userId;
    try {
      const result = await fn(req, userId, ctx);
      return result instanceof Response ? result : Response.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof z.ZodError)
        return Response.json({ error: e.issues[0]?.message ?? "That doesn’t look right.", issues: e.issues }, { status: 422 });
      if (e instanceof ClientError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Something went wrong on our side. Your change wasn’t saved." }, { status: 500 });
    }
  };
}

export async function body(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new ClientError("Expected a JSON body.");
  }
}

import "server-only";
import { z } from "zod";
import { auth } from "./auth";
import { dbReady } from "./db";
import { ClientError } from "./errors";
import { requestContext } from "./events";
import { rateLimited, userForToken } from "./tokens";

type Handler<C> = (req: Request, userId: string, ctx: C) => Promise<unknown>;

/**
 * Authenticates a request: the session cookie (the app), or `Authorization: Bearer mgn_…`
 * (the public API, rate limited per token). Returns the user id or an error Response.
 */
export async function authenticate(req: Request): Promise<{ userId: string; via: "session" | "token" } | Response> {
  await dbReady();
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const found = await userForToken(header.slice(7).trim());
    if (!found) return Response.json({ error: "That API token isn’t valid. Create a new one in Settings → API." }, { status: 401 });
    const wait = rateLimited(found.tokenId);
    if (wait !== null)
      return Response.json({ error: `Too many requests. Try again in ${wait}s.` }, { status: 429, headers: { "retry-after": String(wait) } });
    return { userId: found.userId, via: "token" };
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  return { userId: session.user.id, via: "session" };
}

/**
 * Wraps a route handler: authenticates, runs it inside the request context (so change
 * events know which tab caused them), and maps errors to JSON with a human message.
 * Every query inside is scoped by the userId passed in.
 */
export function route<C = unknown>(fn: Handler<C>, opts: { sessionOnly?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    const who = await authenticate(req);
    if (who instanceof Response) return who;
    if (opts.sessionOnly && who.via !== "session")
      return Response.json({ error: "This endpoint isn’t available with an API token." }, { status: 403 });
    try {
      const result = await requestContext.run({ clientId: req.headers.get("x-client-id"), userId: who.userId }, () => fn(req, who.userId, ctx));
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

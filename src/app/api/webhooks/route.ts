import { z } from "zod";
import { db } from "@/server/db";
import { body, route } from "@/server/http";
import { createWebhook, listWebhooks } from "@/server/webhooks";

export const GET = route(async (_req, userId) => listWebhooks(db, userId), { sessionOnly: true });

/** Returns the signing secret once. */
export const POST = route(
  async (req, userId) => {
    const input = z.object({ url: z.string().trim().max(2000), events: z.array(z.string()).max(10).default(["*"]) }).parse(await body(req));
    return Response.json(await createWebhook(db, userId, input), { status: 201 });
  },
  { sessionOnly: true },
);

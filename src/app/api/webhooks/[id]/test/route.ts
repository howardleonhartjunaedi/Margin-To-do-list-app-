import { db } from "@/server/db";
import { route } from "@/server/http";
import { pingWebhook } from "@/server/webhooks";

type Ctx = { params: Promise<{ id: string }> };

/** Queues a "ping" delivery; the scheduler sends it within a few seconds. */
export const POST = route<Ctx>(
  async (_req, userId, { params }) => {
    await pingWebhook(db, userId, (await params).id);
    return { ok: true };
  },
  { sessionOnly: true },
);

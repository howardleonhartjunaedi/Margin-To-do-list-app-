import { z } from "zod";
import { db } from "@/server/db";
import { body, route } from "@/server/http";
import { deleteWebhook, updateWebhook } from "@/server/webhooks";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(
  async (req, userId, { params }) => {
    const patch = z.object({ events: z.array(z.string()).max(10).optional(), active: z.boolean().optional() }).parse(await body(req));
    return updateWebhook(db, userId, (await params).id, patch);
  },
  { sessionOnly: true },
);

export const DELETE = route<Ctx>(
  async (_req, userId, { params }) => {
    await deleteWebhook(db, userId, (await params).id);
    return { ok: true };
  },
  { sessionOnly: true },
);

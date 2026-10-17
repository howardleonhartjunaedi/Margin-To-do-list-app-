import { db } from "@/server/db";
import { route } from "@/server/http";
import { listDeliveries } from "@/server/webhooks";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, userId, { params }) => listDeliveries(db, userId, (await params).id), { sessionOnly: true });

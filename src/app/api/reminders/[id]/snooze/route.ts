import { body, route } from "@/server/http";
import { snooze } from "@/server/notify";
import { snoozeSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Also called from the service worker's notification action buttons. */
export const POST = route<Ctx>(async (req, userId, { params }) => snooze(userId, (await params).id, snoozeSchema.parse(await body(req))));

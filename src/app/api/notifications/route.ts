import { z } from "zod";
import { body, route } from "@/server/http";
import { listNotifications, markRead } from "@/server/notify";

export const GET = route(async (_req, userId) => listNotifications(userId));

/** Mark read: { ids: [...] } or { all: true } */
export const POST = route(async (req, userId) => {
  const input = z.union([z.object({ ids: z.array(z.string()).max(200) }), z.object({ all: z.literal(true) })]).parse(await body(req));
  await markRead(userId, "all" in input ? "all" : input.ids);
  return listNotifications(userId);
});

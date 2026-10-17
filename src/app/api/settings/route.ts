import { body, route } from "@/server/http";
import { readSettings, updateSettings } from "@/server/notify";
import { settingsSchema } from "@/lib/validation";

export const GET = route(async (_req, userId) => readSettings(userId));

export const PATCH = route(async (req, userId) => {
  await updateSettings(userId, settingsSchema.parse(await body(req)));
  return readSettings(userId);
});

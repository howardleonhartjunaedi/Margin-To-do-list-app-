import { body, route } from "@/server/http";
import { completedOn, dayLoad, getDay, saveDay } from "@/server/productivity";
import { dayPatchSchema, isoDateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ date: string }> };

export const GET = route<Ctx>(async (_req, userId, { params }) => {
  const date = isoDateSchema.parse((await params).date);
  const [day, load, completed] = await Promise.all([getDay(userId, date), dayLoad(userId, date), completedOn(userId, date)]);
  return { ...day, load, completed };
});

export const PUT = route<Ctx>(async (req, userId, { params }) => {
  const date = isoDateSchema.parse((await params).date);
  const day = await saveDay(userId, date, dayPatchSchema.parse(await body(req)));
  const [load, completed] = await Promise.all([dayLoad(userId, date), completedOn(userId, date)]);
  return { ...day, load, completed };
});

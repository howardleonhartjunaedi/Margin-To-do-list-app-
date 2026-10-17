import { z } from "zod";
import { route } from "@/server/http";
import { getStats } from "@/server/productivity";
import { isoDateSchema } from "@/lib/validation";

export const GET = route(async (req, userId) => {
  const q = new URL(req.url).searchParams;
  const { from, to } = z
    .object({ from: isoDateSchema, to: isoDateSchema })
    .refine((v) => v.from <= v.to, "from must be before to")
    .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 400, "Pick a range of a year or less.")
    .parse({ from: q.get("from"), to: q.get("to") });
  return getStats(userId, from, to);
});

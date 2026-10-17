import { z } from "zod";
import { route } from "@/server/http";
import { getCounts, listLabels } from "@/server/tasks";

/** Sidebar badges plus the user's labels, in one round trip. */
export const GET = route(async (req, userId) => {
  const today = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .parse(new URL(req.url).searchParams.get("today"));
  const [counts, labels] = await Promise.all([getCounts(userId, today), listLabels(userId)]);
  return { ...counts, labels: labels.map((l) => l.name) };
});

import { z } from "zod";
import { body, route } from "@/server/http";
import { importData } from "@/server/integrations";

/** { format: "json" | "csv" | "text", content, dryRun? } — dryRun returns what would happen. */
export const POST = route(async (req, userId) => {
  const input = z
    .object({ format: z.enum(["json", "csv", "text"]), content: z.string().max(2_100_000), dryRun: z.boolean().optional() })
    .parse(await body(req));
  return importData(userId, input);
});

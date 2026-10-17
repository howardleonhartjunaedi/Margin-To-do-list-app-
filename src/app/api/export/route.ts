import { route } from "@/server/http";
import { exportCsv, exportJson } from "@/server/integrations";

export const GET = route(async (req, userId) => {
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const day = new Date().toISOString().slice(0, 10);
  if (format === "csv")
    return new Response(await exportCsv(userId), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="margin-tasks-${day}.csv"` },
    });
  return new Response(JSON.stringify(await exportJson(userId), null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="margin-${day}.json"` },
  });
});

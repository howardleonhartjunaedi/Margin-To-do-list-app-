import { dbReady } from "@/server/db";
import { feedFor } from "@/server/integrations";

type Ctx = { params: Promise<{ token: string }> };

/** Private calendar feed. The token in the URL is the only credential, so it's long and revocable. */
export async function GET(_req: Request, { params }: Ctx) {
  await dbReady();
  const token = (await params).token.replace(/\.ics$/, "");
  const body = await feedFor(token);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="margin.ics"',
      "cache-control": "private, max-age=300",
    },
  });
}

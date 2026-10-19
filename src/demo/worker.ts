/*
 * The demo's API, running in a Web Worker in the visitor's browser. It serves the app's real
 * route handlers (src/app/api/**) against an in-memory database, so every feature works with
 * no server behind it. Nothing persists: a reload starts again from the sample data.
 * Built by scripts/build-demo.mjs; the app talks to it through src/lib/demo.ts.
 */
import { routes } from "demo:routes";
import { dbReady } from "@/server/db";
import { seed } from "./seed";

export type Call = (method: string, path: string, body?: unknown) => Promise<Response>;

const ORIGIN = "http://demo.local";

async function handle(method: string, path: string, headers: Record<string, string>, body: string | null): Promise<Response> {
  const url = new URL(path, ORIGIN);
  for (const r of routes) {
    const match = r.pattern.exec(url.pathname);
    if (!match) continue;
    const handler = r.mod[method] as ((req: Request, ctx: unknown) => Promise<Response>) | undefined;
    if (!handler) return Response.json({ error: "Not supported." }, { status: 405 });
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
    return handler(new Request(url, { method, headers, body: method === "GET" || method === "HEAD" ? null : body }), { params: Promise.resolve(params) });
  }
  return Response.json({ error: "That isn’t available in the demo." }, { status: 501 });
}

const call: Call = (method, path, body) => handle(method, path, { "content-type": "application/json" }, body === undefined ? null : JSON.stringify(body));

const started = (async () => {
  await dbReady();
  await seed(call);
})();
started.catch((e) => console.error("[demo] setup failed", e));

self.onmessage = async (e: MessageEvent<{ id: number; method: string; path: string; headers: Record<string, string>; body: string | null }>) => {
  const { id, method, path, headers, body } = e.data;
  try {
    await started;
    const res = await handle(method, path, headers, body);
    self.postMessage({ id, status: res.status, headers: [...res.headers], body: await res.text() });
  } catch (err) {
    console.error("[demo]", method, path, err);
    self.postMessage({ id, status: 500, headers: [["content-type", "application/json"]], body: JSON.stringify({ error: "The demo hit a snag. Reload to start over." }) });
  }
};

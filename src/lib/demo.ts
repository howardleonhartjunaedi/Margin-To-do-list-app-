/*
 * The browser demo's side of the API: requests go to a Web Worker running the app's real
 * route handlers on an in-memory database (src/demo/worker.ts) instead of to the server.
 */
import { DEMO_COOKIE } from "@/demo/user";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

type Reply = { id: number; status: number; headers: [string, string][]; body: string };

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (r: Reply) => void>();

function start() {
  if (worker) return worker;
  worker = new Worker("/demo/api-worker.js", { type: "module" });
  worker.onmessage = (e: MessageEvent<Reply>) => {
    waiting.get(e.data.id)?.(e.data);
    waiting.delete(e.data.id);
  };
  return worker;
}

export function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const id = ++seq;
  const w = start();
  return new Promise((resolve) => {
    waiting.set(id, (r) => resolve(new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers })));
    w.postMessage({ id, method: (init.method ?? "GET").toUpperCase(), path, headers: Object.fromEntries(new Headers(init.headers).entries()), body: typeof init.body === "string" ? init.body : null });
  });
}

export function startDemo() {
  document.cookie = `${DEMO_COOKIE}=1; path=/; samesite=lax`;
}

/** Leaving the demo: the cookie goes, and the worker (with everything typed) with it. */
export function endDemo() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`;
  worker?.terminate();
  worker = null;
}

import { subscribe, type ChangeEvent } from "@/server/events";
import { authenticate } from "@/server/http";

/**
 * Server-sent events: a long-lived stream of "something you can see changed" notices
 * for the signed-in user. Clients refetch what's affected; the payload never carries
 * task contents, so nothing leaks to a stale subscription.
 */
export async function GET(req: Request) {
  const who = await authenticate(req);
  if (who instanceof Response) return who;

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(`retry: 3000\nevent: ready\ndata: {}\n\n`);
      const unsubscribe = subscribe(who.userId, (e: ChangeEvent) => send(`event: change\ndata: ${JSON.stringify(e)}\n\n`));
      // Comment lines keep proxies from closing an idle connection.
      const heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

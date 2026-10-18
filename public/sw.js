/*
 * Margin service worker: push notifications, plus offline reading.
 *
 * Caching only runs when registered as /sw.js?cache=1 (production builds). In development the
 * worker handles push alone, so it never serves stale code under hot reload.
 *
 *   /_next/static, fonts, icons   cache-first (file names are content-hashed)
 *   pages and RSC payloads        network-first, falling back to the last copy, then /offline
 *   GET /api/*                    network-first, falling back to the last response
 *   writes, auth, the event stream  never cached
 *
 * Offline writes are not handled here: the app queues them itself (src/lib/outbox.ts) and
 * replays them on reconnect, so they work the same in every browser.
 */

const VERSION = "v1";
const STATIC = `margin-static-${VERSION}`;
const PAGES = `margin-pages-${VERSION}`;
const API = `margin-api-${VERSION}`;
const CACHING = new URL(self.location.href).searchParams.get("cache") === "1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (CACHING) event.waitUntil(caches.open(PAGES).then((c) => c.add("/offline")).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = CACHING ? [STATIC, PAGES, API] : [];
      for (const key of await caches.keys()) if (key.startsWith("margin-") && !keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// Signing out (or switching accounts) drops everything personal this device kept.
self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-user-data") event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(API)]));
});

self.addEventListener("fetch", (event) => {
  if (!CACHING) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/api/auth") || p === "/api/events" || p.startsWith("/api/ical")) return;

  if (p.startsWith("/_next/static/") || p.startsWith("/icons/") || /\.(woff2|svg|png|ico)$/.test(p)) {
    event.respondWith(cacheFirst(req));
  } else if (p.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API));
  } else if (req.mode === "navigate") {
    event.respondWith(page(req));
  } else if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(req, PAGES));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    // Only keep successful, personal-but-ours responses; never a redirect to sign-in.
    if (res.ok && !res.redirected) (await caches.open(cacheName)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { cacheName });
    if (hit) return hit;
    throw err;
  }
}

async function page(req) {
  try {
    return await networkFirst(req, PAGES);
  } catch {
    // Never visited this page while online: the Today shell can still show what's cached.
    return (await caches.match("/today", { cacheName: PAGES })) ?? (await caches.match("/offline", { cacheName: PAGES })) ?? Response.error();
  }
}

/* ------------------------------ Push ------------------------------ */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "Reminder" };
  }
  const actions = data.reminderId
    ? [
        { action: "done", title: "Done" },
        { action: "snooze", title: "Snooze 10 min" },
      ]
    : [];
  event.waitUntil(
    self.registration.showNotification(data.title || "Reminder", {
      body: data.body || "",
      tag: data.tag,
      renotify: !!data.tag,
      requireInteraction: !!data.reminderId,
      data: { url: data.url || "/today", reminderId: data.reminderId, taskId: data.taskId },
      actions,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const { url, reminderId, taskId } = n.data || {};
  n.close();

  const api = (path, method, body) =>
    fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  if (event.action === "done" && taskId) {
    event.waitUntil(api(`/api/tasks/${taskId}`, "PATCH", { completed: true }));
    return;
  }
  if (event.action === "snooze" && reminderId) {
    event.waitUntil(api(`/api/reminders/${reminderId}/snooze`, "POST", { minutes: 10 }));
    return;
  }
  event.waitUntil(
    (async () => {
      const target = new URL(url, self.location.origin).href;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          return w.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

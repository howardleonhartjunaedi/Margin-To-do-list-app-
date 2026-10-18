"use client";

/*
 * One service worker for push and offline reading. Production builds register it with
 * ?cache=1, which turns its caching on; development keeps it to push only, so hot reload
 * never fights a stale cache.
 */

const SW_URL = process.env.NODE_ENV === "production" ? "/sw.js?cache=1" : "/sw.js";

export const swSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator;

/** Registers (or updates to) the right worker script and returns its registration. */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!swSupported()) return undefined;
  const current = await navigator.serviceWorker.getRegistration("/");
  const script = current?.active?.scriptURL ?? current?.installing?.scriptURL ?? current?.waiting?.scriptURL;
  if (current && script && new URL(script).search === new URL(SW_URL, location.origin).search) return current;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

/** Forget every page and API response this device kept (on sign-out). */
export async function clearOfflineData() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "clear-user-data" });
    for (const key of await caches.keys()) if (key.startsWith("margin-pages") || key.startsWith("margin-api")) await caches.delete(key);
  } catch {}
}

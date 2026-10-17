/* Margin service worker — Phase 2: push notifications only. (Offline caching arrives with the PWA in Phase 7.) */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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

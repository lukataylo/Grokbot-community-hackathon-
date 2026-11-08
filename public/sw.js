/* Lumzel service worker: push notifications and opening the right screen. No offline caching of private data. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "lumzel", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "lumzel", {
    body: d.body || "", tag: d.tag, icon: "/icons/192.png", badge: "/icons/favicon-32.png", data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});

self.addEventListener("fetch", () => { /* network only: always fresh, never cached */ });

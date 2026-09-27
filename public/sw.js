const CACHE_NAME = "barrera-brokers-crm-v2";
const STATIC_ASSETS = [
  "/crm-icon-192.png",
  "/crm-icon-512.png",
  "/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .catch(() => undefined)
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Never persist authenticated HTML or React Server Component payloads.
  if (!STATIC_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || "BB CRM", {
    body: payload.body || "Tenés una nueva notificación en el CRM.",
    icon: "/crm-icon-192.png", badge: "/crm-icon-192.png",
    tag: payload.tag || "crm-notification", data: { href: crmNotificationUrl(payload.href) },
  }));
});

function crmNotificationUrl(href) {
  try {
    const url = new URL(href || "/admin/crm", self.location.origin);
    if (url.origin === self.location.origin && (url.pathname === "/admin/crm" || url.pathname.startsWith("/admin/crm/"))) return url.href;
  } catch {}
  return self.location.origin + "/admin/crm";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = crmNotificationUrl(event.notification.data?.href);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find((item) => new URL(item.url).origin === self.location.origin && new URL(item.url).pathname.startsWith("/admin/crm"));
    if (client) { await client.navigate(href); await client.focus(); }
    else await self.clients.openWindow(href);
  })());
});

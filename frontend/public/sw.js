/* Service worker for «عاجل» breaking alerts.
   Kept deliberately small: it exists to show a notification and to open the
   story when tapped. No caching — a news site serving stale pages from a
   worker is worse than one that simply fetches. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "عاجل", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "عاجل", {
      body: data.body || "",
      dir: "rtl",
      lang: "ar",
      tag: data.tag || "breaking",
      renotify: true,
      badge: "/icon.png",
      icon: "/icon.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Reuse an open tab rather than piling up windows on every alert.
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

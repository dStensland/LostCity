// Service Worker for Push Notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, url, tag } = data;

    event.waitUntil(
      self.registration.showNotification(title || "LostCity", {
        body: body || "",
        icon: icon || "/icon-192.png",
        badge: "/icon-192.png",
        tag: tag || "default",
        data: { url: url || "/" },
        vibrate: [200, 100, 200],
      })
    );
  } catch (err) {
    console.error("Push event error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      return clients.openWindow(url);
    })
  );
});

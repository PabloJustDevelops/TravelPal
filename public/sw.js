// Service worker de TravelPal.
// Solo gestiona notificaciones push: no cachea ni intercepta el trafico de la
// app (no se registra una estrategia offline). El payload esperado es JSON:
// { title, body, url }.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Un payload ilegible no puede tumbar el worker: se cae al aviso generico.
    payload = {};
  }

  const title = payload.title || "TravelPal";
  const options = {
    body: payload.body || "",
    data: { url: payload.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const target = new URL(data.url || "/dashboard", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === target && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
        return undefined;
      }),
  );
});

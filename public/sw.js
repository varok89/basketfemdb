/* ── BasketFem DB Service Worker ── */
const CACHE_NAME = "basketfem-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/index.html"]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  /* Solo interceptar mismo origen y GET */
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;

  /* Navegación → red primero, fallback a index.html */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  /* Assets estáticos → cache first */
  if (
    url.pathname.startsWith("/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".svg")
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
  }
});
// ──── AÑADIR ESTO AL FINAL DE TU sw.js ACTUAL ────

// Push notifications
self.addEventListener('push', function(event) {
  let data = { title: 'La Basketneta', body: '' };
  try {
    data = event.data.json();
  } catch {
    data.body = event.data ? event.data.text() : '';
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'La Basketneta', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data || {},
      vibrate: [200, 100, 200],
      tag: data.data?.tipo || 'general',
      renotify: true,
    })
  );
});

// Al hacer clic en la notificación, abrir la app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/';
  
  if (data.id_jugadora) url = `/jugadoras/${data.id_jugadora}`;
  else if (data.id_partido) url = `/partidos/partido/${data.id_partido}`;
  else if (data.id_equipo) url = `/equipos/${data.id_equipo}`;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('labasketneta.app') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
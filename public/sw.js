/* ── La Basketneta Service Worker ── */
const CACHE_NAME = "basketneta-v4";
const API_CACHE  = "basketneta-api-v1";
const API_MAX_ENTRIES = 200;

/* Solo cachea GETs a estas tablas públicas de Supabase (nunca perfiles / favoritos / quinielas) */
const API_PUBLIC_PATTERN = /\/rest\/v1\/(jugadoras|equipos|ligas|coaches|partidos|partido_boxscore|temporadas|carreras)(\?|$)/;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/index.html"]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  const keep = new Set([CACHE_NAME, API_CACHE]);
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const req of keys.slice(0, keys.length - max)) await cache.delete(req);
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  /* API pública de Supabase: stale-while-revalidate */
  if (url.hostname.endsWith(".supabase.co") && API_PUBLIC_PATTERN.test(url.pathname + url.search)) {
    e.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          cache.put(e.request, res.clone());
          trimCache(API_CACHE, API_MAX_ENTRIES);
        }
        return res;
      }).catch(() => null);
      return cached || (await network) || new Response(JSON.stringify({ error: "offline" }), {
        status: 503, headers: { "Content-Type": "application/json" }
      });
    })());
    return;
  }

  /* Solo interceptar mismo origen a partir de aquí */
  if (url.origin !== self.location.origin) return;

  /* Navegación → red primero, fallback a index.html */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  /* Assets con hash (main.abc123.js, chunk.def456.css) → cache first */
  /* Assets sin hash (sw.js, manifest.json) → siempre red */
  const hasHash = /\.[a-f0-9]{8,}\.(js|css)$/i.test(url.pathname);
  const isStatic = url.pathname.startsWith("/static/") ||
                   url.pathname.startsWith("/assets/") ||
                   url.pathname.endsWith(".ico") ||
                   url.pathname.endsWith(".png") ||
                   url.pathname.endsWith(".svg");

  if (hasHash || isStatic) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, resClone));
          }
          return res;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
  }
});

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

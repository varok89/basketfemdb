/* ── BasketFem DB Service Worker ── */
const CACHE_NAME = "basketfem-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/static/js/vendors~main.chunk.js",
];

/* Instalación: cachea el shell de la app */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        /* Si algún asset no existe en este build, lo ignoramos */
      });
    })
  );
  self.skipWaiting();
});

/* Activación: limpia caches antiguas */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Fetch: estrategia mixta */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  /* Supabase y APIs externas → siempre red (datos en tiempo real) */
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.io") ||
    url.hostname.includes("flagcdn.com") ||
    url.hostname.includes("flagpedia.net") ||
    url.hostname.includes("wsrv.nl")
  ) {
    return; /* deja pasar sin interceptar */
  }

  /* Archivos estáticos → cache first, red como fallback */
  if (
    e.request.method === "GET" &&
    (url.pathname.startsWith("/static/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".ico"))
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  /* HTML (navegación) → red first, cache como fallback */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match("/index.html")
      )
    );
  }
});

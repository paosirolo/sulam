/* eslint-disable no-restricted-globals */

const VERSION = "v1";
const APP_SHELL_CACHE = `sulam-app-shell-${VERSION}`;
const ASSET_CACHE = `sulam-assets-${VERSION}`;
const SUPABASE_CACHE = `sulam-supabase-${VERSION}`;
const CANTI_CACHE = `sulam-canti-${VERSION}`;

const SUPABASE_URL = "https://woqwxnaqwgdfchlhrzpz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXd4bmFxd2dkZmNobGhyenB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDQwODEsImV4cCI6MjA4ODI4MDA4MX0.rmRrq-j-L0QChhDgCt1Ou9bxfXAIlpKHNUlNqeSWVUY";

const APP_SHELL_URLS = ["/", "/index.html", "/manifest.json", "/logo.svg", "/logo.png"];

function isSupabaseRequest(url) {
  return url.origin === new URL(SUPABASE_URL).origin;
}

function isCantiRequest(url) {
  return (
    isSupabaseRequest(url) &&
    url.pathname.includes("/rest/v1/sulam_canti")
  );
}

async function cachePut(cacheName, request, response) {
  if (!response || response.status !== 200) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await cache.addAll(APP_SHELL_URLS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              ![
                APP_SHELL_CACHE,
                ASSET_CACHE,
                SUPABASE_CACHE,
                CANTI_CACHE,
              ].includes(k)
          )
          .map((k) => caches.delete(k))
      );

      // Prefetch all songs into cache for full offline use.
      try {
        const url = `${SUPABASE_URL}/rest/v1/sulam_canti?select=*`;
        const req = new Request(url, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        const res = await fetch(req);
        if (res && res.ok) {
          await cachePut(CANTI_CACHE, req, res.clone());
        }
      } catch {
        // If offline during first activation, we'll fill caches later via fetch handlers.
      }

      await self.clients.claim();
    })()
  );
});

async function cacheFirstWithRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const fetchPromise = (async () => {
    try {
      const network = await fetch(event.request);
      await cachePut(cacheName, event.request, network.clone());
      return network;
    } catch {
      return null;
    }
  })();

  if (cached) {
    event.waitUntil(fetchPromise);
    return cached;
  }

  const network = await fetchPromise;
  if (network) return network;
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

async function networkFirst(event, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const network = await fetch(event.request);
    await cachePut(cacheName, event.request, network.clone());
    return network;
  } catch {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // SPA navigation: try network, fallback to cached app shell.
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(event.request);
          await cachePut(APP_SHELL_CACHE, "/", network.clone());
          return network;
        } catch {
          const cache = await caches.open(APP_SHELL_CACHE);
          const cached = await cache.match("/") || (await cache.match("/index.html"));
          return cached || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Cache-first for same-origin static assets.
  const isSameOrigin = url.origin === self.location.origin;
  const dest = event.request.destination;
  if (
    isSameOrigin &&
    ["script", "style", "image", "font"].includes(dest)
  ) {
    event.respondWith(cacheFirstWithRevalidate(event, ASSET_CACHE));
    return;
  }

  // Supabase REST: cache-first (stale-while-revalidate) for canti, network-first for the rest.
  if (isSupabaseRequest(url)) {
    if (isCantiRequest(url)) {
      event.respondWith(cacheFirstWithRevalidate(event, CANTI_CACHE));
    } else {
      event.respondWith(networkFirst(event, SUPABASE_CACHE));
    }
  }
});


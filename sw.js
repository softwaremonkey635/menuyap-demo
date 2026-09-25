/* MENÜYAP service worker — app shell cache with an offline fallback.
   Dependency free. Bumping CACHE invalidates every stored response. */

const CACHE = "menuyap-shell-v1";
const root = new URL(self.registration.scope).pathname.replace(/\/?$/, "/");

/* Shell precached at install: start page, manifest, icons. */
const SHELL = [
  root,
  `${root}manifest.webmanifest`,
  `${root}icon-192x192.png`,
  `${root}icon-512x512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function offlinePage() {
  return new Response(
    '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>MENÜYAP</title><p>Bağlantı yok. Sayfayı birazdan tekrar deneyin.</p></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/* Navigations: network first so menus stay current, cache as fallback. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  } catch {
    const cached = (await caches.match(request)) || (await caches.match(root));
    return cached || offlinePage();
  }
}

/* Hashed build output and images: cache first, they never change in place. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const cacheable =
    url.pathname.startsWith(`${root}_next/static/`) ||
    /\.(?:png|jpe?g|svg|ico|webmanifest)$/.test(url.pathname);
  if (!cacheable) return;

  event.respondWith(cacheFirst(request).catch(() => Response.error()));
});

const CACHE_NAME = "lusthub-v2"; // Pinalitan natin ang version para ma-force update
const urlsToCache = ["/", "/style.css", "/app.js", "/favicon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // Pilitin ang bagong Service Worker na gumana agad
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
  );
});

self.addEventListener("activate", (event) => {
  // Burahin ang mga lumang cache kapag may bagong version
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // NETWORK FIRST STRATEGY: Kukuha muna sa internet. Kapag offline, tsaka gagamit ng Cache.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    }),
  );
});

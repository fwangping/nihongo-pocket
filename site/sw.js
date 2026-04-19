const CACHE_NAME = "nihongo-pocket-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./data.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request);
    })
  );
});

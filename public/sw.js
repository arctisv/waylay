// Waylay service worker: keeps the app shell available offline.
// Bump the version when the caching rules change, so old caches are cleared.
const CACHE = 'waylay-shell-v1';
const STATIC_FILES = ['/manifest.webmanifest', '/icon.svg', '/favicon.ico', '/icons/icon-192.png', '/icons/icon-512.png'];

// Caches the page plus every build asset it references, so the next visit works with no network.
async function precache() {
  const cache = await caches.open(CACHE);
  const response = await fetch('/', { cache: 'reload' });
  const html = await response.clone().text();
  await cache.put('/', response);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
  await cache.addAll([...STATIC_FILES, ...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: try the network for the latest version, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Build assets have content hashes in their names, so a cached copy is always correct.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

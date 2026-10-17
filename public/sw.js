/* Waylay's service worker: the app works offline.
 *
 * Everything Waylay needs lives in this browser already — the chats in
 * IndexedDB, the models in the Cache API — so the only thing standing
 * between a dead connection and a working app is the page itself. This
 * worker keeps a copy of the page and its assets as they load.
 *
 * Network first, always: online, every request goes to the network and the
 * copy is refreshed on the way back, so a deploy is picked up on the next
 * load and one build's markup never meets another build's chunks. Only when
 * the network can't answer does the stored copy step in. Model downloads
 * come from other origins and are left alone; their own cache holds them.
 *
 * It also makes the page cross-origin isolated by adding the two headers
 * static hosts can't: that unlocks multi-threaded WebAssembly, which the
 * processor model and voice input run several times faster with. It takes
 * effect from the second visit, once the worker controls the page.
 *
 * Bump CACHE to drop every stored copy on the next activation.
 */

const CACHE = "waylay-shell-v2";

/* The worker's scope is the app's base ("/" or "/waylay/"). */
const BASE = new URL(self.registration.scope).pathname;

/** The page with the isolation headers added. */
function isolated(response) {
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.add(new Request(BASE, { cache: "reload" }));
      } catch {
        // Offline at install time; the fetch path fills the cache later.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("waylay-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  event.respondWith(
    (async () => {
      const navigation = request.mode === "navigate";
      try {
        const response = await fetch(request);
        /* Only keep what arrived intact — an errored response stored here
           would outlive the outage that caused it. */
        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE);
          /* Every route is the same page (the path after # never reaches
             the server), so navigations share one entry. */
          const key = navigation ? BASE : request;
          cache.put(key, response.clone());
        }
        return navigation ? isolated(response) : response;
      } catch (error) {
        const cached = await caches.match(navigation ? BASE : request, {
          ignoreSearch: navigation,
        });
        if (cached) return navigation ? isolated(cached) : cached;
        throw error;
      }
    })(),
  );
});

/*
 * The admin panel's service worker.
 *
 * It exists mainly to be there. Chrome has long distinguished between
 * "Add to Home screen", which makes a bookmark that opens in a browser
 * tab with the address bar, and "Install", which mints a real app — and
 * a registered worker with a fetch handler is part of what decides
 * which one is offered. A panel that opens with an address bar is the
 * thing this is here to prevent.
 *
 * It is registered with scope /admin, so it never sees a request for
 * the public site. It precaches nothing: the entry document references
 * hashed asset URLs, and a cached shell from a previous deploy would go
 * looking for chunks that deploy no longer names. Network wins whenever
 * there is a network, and the cache is only consulted when there is not.
 */

const CACHE = 'osc-admin-v1';

self.addEventListener('install', () => {
  /* Nothing to precache; take over as soon as the old one is gone. */
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name.startsWith('osc-admin-') && name !== CACHE)
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  /*
   * Only the panel's own documents. Everything else — the API, the
   * hashed chunks, the fonts — is left to the browser, which handles
   * revalidation and range requests better than anything written here.
   */
  if (request.method !== 'GET' || request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);

        /* Keep the last good shell, for a launch with no signal. */
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());

        return fresh;
      } catch (offline) {
        const cached = await caches.match(request);

        if (cached) return cached;

        /* A launch straight into the panel, offline and never cached. */
        const shell = await caches.match('/admin');

        if (shell) return shell;

        throw offline;
      }
    })(),
  );
});

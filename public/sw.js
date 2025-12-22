const VERSION = 'v2';
const CACHE_PREFIX = 'luckcalendar-';
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;

// Minimal app-shell cache. Vite-built assets are fingerprinted and will be cached
// dynamically by the fetch handler below.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

const isSameOrigin = (url) => {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
};

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Allow the page to tell the SW to activate immediately.
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (fonts, CDNs, etc). Let the browser handle them.
  if (!isSameOrigin(event.request.url)) {
    return;
  }

  const req = event.request;
  const url = new URL(req.url);

  // SPA navigation: network-first for HTML, fallback to cached index.html
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // Static assets: cache-first with background refresh (stale-while-revalidate).
  const isAsset = /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
            }
            return res;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
    return;
  }

  // Everything else: network-first, fallback to cache.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
  );
});

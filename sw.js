const CACHE_NAME = 'miniplayer-static-v1';
const RUNTIME_CACHE = 'miniplayer-runtime-v1';

const PRECACHE_URLS = [
    './',
    './index.html',
    './settings.html',
    './manifest.json',
    './favicon.ico'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener('activate', (event) => {
    const expectedCaches = [CACHE_NAME, RUNTIME_CACHE];
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => (expectedCaches.includes(key) ? null : caches.delete(key)))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const requestUrl = new URL(event.request.url);

    // Network-first for API requests (try network, fallback to cache)
    if (requestUrl.pathname.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for other requests (static assets)
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request)
                .then((response) => {
                    // Only cache valid responses
                    if (!response || response.status !== 200) return response;
                    const copy = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
                    return response;
                })
                .catch(() => {
                    // If navigation fails, return cached index.html as SPA fallback
                    if (event.request.mode === 'navigate') return caches.match('./index.html');
                });
        })
    );
});

// Allow the page to trigger skipWaiting via postMessage
self.addEventListener('message', (event) => {
    if (!event.data) return;
    if (event.data === 'SKIP_WAITING' || event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

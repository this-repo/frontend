const CACHE_NAME = 'miniplayer-static-v1';
const RUNTIME_CACHE = 'miniplayer-runtime-v1';
const AUDIO_CACHE = 'miniplayer-audio-v1';
const AUDIO_MAX_ENTRIES = 20; // keep most recent 20 audio files

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
        caches.open(CACHE_NAME).then(async (cache) => {
            const results = await Promise.allSettled(
                PRECACHE_URLS.map((url) => fetch(url).then((res) => {
                    if (!res || res.status !== 200) throw new Error('Bad response');
                    return cache.put(url, res);
                }))
            );
            // ignore individual failures but ensure install doesn't hang
            return results;
        })
    );
});

// Trim a cache to at most `maxItems` by deleting oldest entries
async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;
    const deleteCount = keys.length - maxItems;
    for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
    }
}

self.addEventListener('activate', (event) => {
    const expectedCaches = [CACHE_NAME, RUNTIME_CACHE, AUDIO_CACHE];
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

    // Handle audio requests with a bounded cache (cache-first, trim LRU)
    const isAudio = event.request.destination === 'audio' || /\.(mp3|m4a|wav|ogg)$/i.test(requestUrl.pathname);
    if (isAudio) {
        event.respondWith(
            caches.open(AUDIO_CACHE).then(async (cache) => {
                const cacheKey = requestUrl.href;
                const cached = await cache.match(event.request) || await cache.match(cacheKey);
                if (cached) return cached;

                try {
                    const response = await fetch(event.request);
                    if (!response || !(response.status === 200 || response.status === 206)) return response;

                    const copy = response.clone();
                    await cache.put(cacheKey, copy);
                    await trimCache(AUDIO_CACHE, AUDIO_MAX_ENTRIES);
                    return response;
                } catch (error) {
                    return cached;
                }
            })
        );
        return;
    }

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

    // Network-first for navigation (HTML) to prefer fresh content
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
                        return response;
                    }
                    return caches.match('./index.html');
                })
                .catch(() => caches.match('./index.html'))
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

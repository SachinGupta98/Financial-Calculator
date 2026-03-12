// FinFlap Service Worker — Cache-first with network fallback

const CACHE_NAME = 'finflap-v2';
const STATIC_ASSETS = [
    '/',
    '/static/js/main.js',
    '/static/icon-192.png',
    '/static/icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// ── Install: pre-cache core static assets ──────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('https')));
        }).catch(() => { })
    );
    self.skipWaiting();
});

// ── Activate: clean up old caches ──────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for static ───
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Always use network for API routes and authentication
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/login') ||
        url.pathname.startsWith('/register') || url.pathname.startsWith('/logout')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache-first strategy for static assets
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match('/');
            }
        })
    );
});

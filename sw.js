// Service Worker for The Red Ram Chords (PWA & Offline Stage Mode)
const CACHE_NAME = 'redram-chords-v2.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './editor.html',
  './manifest.json',
  './css/common.css',
  './css/viewer.css',
  './css/editor.css',
  './js/theme.js',
  './js/ui.js',
  './js/chords.js',
  './js/viewer.js',
  './js/editor.js',
  './img/logo.jpg',
  './songs/index.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For GitHub API requests or outside domains, do not cache with Service Worker
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    return;
  }

  // Network-first with cache fallback for songs to ensure latest edits, but work seamlessly offline
  if (url.pathname.includes('/songs/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for application shell
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {/* Offline */});

      return cachedResponse || fetchPromise;
    })
  );
});

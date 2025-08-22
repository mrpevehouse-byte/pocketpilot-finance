// Simple service worker for offline caching (v1)
const CACHE_NAME = 'pocketpilot-v1';
const FILES_TO_CACHE = ['.','index.html','styles.css','app.js','manifest.json'];
self.addEventListener('install', evt=>{ evt.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(FILES_TO_CACHE))); self.skipWaiting(); });
self.addEventListener('activate', evt=>{ evt.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', evt=>{ evt.respondWith(caches.match(evt.request).then(response=> response || fetch(evt.request))); });
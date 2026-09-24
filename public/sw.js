// Sabdham Service Worker - Safe unregister & cache clear
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
    .then(() => self.registration.unregister())
    .then(() => self.clients.claim())
  );
});

// Note: fetch event listener is intentionally omitted so Vite dev server modules and API routes are never intercepted

const CACHE_NAME = 'map-search-shell-v1';
const APP_SHELL = [
  './map.html',
  './manifest.webmanifest',
  './supabase-config.js',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './icons/app-icon.svg',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/opening-hours/opening_hours+deps.min.js',
  './vendor/supabase/supabase.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(cacheNames
          .filter(function (cacheName) {
            return cacheName.indexOf('map-search-shell-') === 0 && cacheName !== CACHE_NAME;
          })
          .map(function (cacheName) { return caches.delete(cacheName); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return fetch(request).then(function (response) {
        if (response.ok) {
          return cache.put(request, response.clone()).then(function () { return response; });
        }
        return response;
      }).catch(function () {
        return cache.match(request).then(function (cachedResponse) {
          if (cachedResponse) return cachedResponse;
          if (request.mode === 'navigate') return cache.match('./map.html');
          return Response.error();
        });
      });
    })
  );
});

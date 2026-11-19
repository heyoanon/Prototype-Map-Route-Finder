const CACHE_NAME = 'map-search-shell-v3';
const TILE_CACHE = 'map-search-tiles-v1';
const DATA_CACHE = 'map-search-data-v1';
const APP_SHELL = [
  './map.html',
  './manifest.webmanifest',
  './supabase-config.js',
  './routing-config.js',
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
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        if (request.mode === 'navigate') {
          return fetch(request).then(function (response) {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(function () {
            return cache.match('./map.html');
          });
        }
        return caches.match(request).then(function (cachedResponse) {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then(function (response) {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  const isTileRequest =
    url.pathname.indexOf('/MapServer/tile/') !== -1 ||
    url.pathname.indexOf('/tile/') !== -1 ||
    url.pathname.endsWith('.png');

  if (isTileRequest) {
    event.respondWith(
      caches.open(TILE_CACHE).then(function (cache) {
        return cache.match(request).then(function (cachedResponse) {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then(function (response) {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(function () {
            return new Response('', { status: 503, statusText: 'Map tile unavailable offline' });
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(DATA_CACHE).then(function (cache) {
      return fetch(request).then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(function () {
        return cache.match(request).then(function (cachedResponse) {
          return cachedResponse || new Response(
            JSON.stringify({ offline: true, error: 'This information is unavailable offline.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        });
      });
    })
  );
});

const CACHE_NAME = 'map-search-shell-v58';
const TILE_CACHE = 'map-search-tiles-v4';
const DATA_CACHE = 'map-search-data-v3';

const APP_SHELL = [
  './',
  './map.html',
  './responder.html',
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
  './vendor/supabase/supabase.min.js',
  '/',
  '/map',
  '/map.html',
  '/responder',
  '/responder.html',
  '/dispatch',
  '/manifest.webmanifest',
  '/icons/app-icon.svg',
  '/icons/app-icon-192.png',
  '/vendor/leaflet/leaflet.css',
  '/vendor/leaflet/leaflet.js'
];

// Pre-cache core regional base tiles for Iloilo City / Oton corridor (zoom 12 & 13)
const PRECACHE_TILES = [];
[
  { z: 12, y: 1925, x: 3441 },
  { z: 13, y: 3851, x: 6883 }
].forEach(function (center) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      PRECACHE_TILES.push(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' +
        center.z + '/' + (center.y + dy) + '/' + (center.x + dx)
      );
      PRECACHE_TILES.push(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/' +
        center.z + '/' + (center.y + dy) + '/' + (center.x + dx)
      );
    }
  }
});

// 1x1 transparent PNG fallback for missing tiles when offline
const TRANSPARENT_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5,
  0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
]);

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async function (cache) {
      await Promise.allSettled(
        APP_SHELL.map(function (url) {
          return fetch(url, { cache: 'reload' }).then(function (response) {
            if (response && response.ok) {
              return cache.put(url, response);
            }
          }).catch(function () { });
        })
      );
    }).then(function () {
      caches.open(TILE_CACHE).then(function (tileCache) {
        PRECACHE_TILES.forEach(function (tileUrl) {
          tileCache.match(tileUrl).then(function (existing) {
            if (!existing) {
              fetch(tileUrl, { mode: 'no-cors' }).then(function (resp) {
                if (resp) tileCache.put(tileUrl, resp);
              }).catch(function () { });
            }
          });
        });
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (cacheName) {
            return (cacheName.indexOf('map-search-shell-') === 0 && cacheName !== CACHE_NAME) ||
              (cacheName.indexOf('map-search-tiles-') === 0 && cacheName !== TILE_CACHE) ||
              (cacheName.indexOf('map-search-data-') === 0 && cacheName !== DATA_CACHE);
          })
          .map(function (cacheName) { return caches.delete(cacheName); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Navigation requests (HTML pages)
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        // Offline navigation fallback
        return caches.open(CACHE_NAME).then(function (cache) {
          const isResponder = url.pathname.includes('responder') || url.pathname.includes('dispatch');
          const targetFallback = isResponder ? './responder.html' : './map.html';
          return cache.match(targetFallback).then(function (matched) {
            if (matched) return matched;
            return cache.match(isResponder ? '/responder.html' : '/map.html').then(function (m2) {
              if (m2) return m2;
              return cache.match('./map.html');
            });
          });
        });
      })
    );
    return;
  }

  // 2. Map tiles (ArcGIS, OpenTopoMap, OSM, etc.)
  const isTileRequest =
    url.pathname.indexOf('/MapServer/tile/') !== -1 ||
    url.pathname.indexOf('/tile/') !== -1 ||
    url.hostname.includes('tile.opentopomap.org') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('server.arcgisonline.com');

  if (isTileRequest) {
    event.respondWith(
      caches.open(TILE_CACHE).then(function (cache) {
        return cache.match(request).then(function (cachedResponse) {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then(function (response) {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(function () {
            // Return 1x1 transparent PNG when offline so Leaflet renders cleanly without broken images
            return new Response(TRANSPARENT_PNG, {
              status: 200,
              headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400'
              }
            });
          });
        });
      })
    );
    return;
  }

  // 3. Same-origin assets (CSS, JS, local icons, vendor files)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(request).then(function (cachedResponse) {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then(function (response) {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(function () {
            if (request.destination === 'image' || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg')) {
              return cache.match('./icons/app-icon.svg');
            }
            return new Response('', { status: 408, statusText: 'Resource unavailable offline' });
          });
        });
      })
    );
    return;
  }

  // 4. External APIs & Data (Photon geocoding, OSRM routing)
  event.respondWith(
    caches.open(DATA_CACHE).then(function (cache) {
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, 3500);

      return fetch(request, { signal: controller.signal }).then(function (response) {
        clearTimeout(timeoutId);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function () {
        clearTimeout(timeoutId);
        return cache.match(request).then(function (cachedResponse) {
          return cachedResponse || new Response(
            JSON.stringify({ offline: true, error: 'Offline mode active - using local database.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        });
      });
    })
  );
});

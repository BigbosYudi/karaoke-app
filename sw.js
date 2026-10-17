var CACHE_PREFIX = 'karaoke-tv-' + encodeURIComponent(self.registration.scope) + '-';
var CACHE_NAME = CACHE_PREFIX + 'v10';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css?v=20261017-2',
  './js/config.js?v=20261017-2',
  './js/queue.js?v=20261017-2',
  './js/search.js?v=20261017-2',
  './js/player.js?v=20261017-2',
  './js/mic.js?v=20261017-2',
  './js/guide.js?v=20261017-2',
  './js/app.js?v=20261017-2',
  './icons/logo-96.png',
  './icons/logo-512.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-48.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') { return; }

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }

  // Konfigurasi lokal (API key) harus selalu diambil dari jaringan agar perubahan langsung berlaku.
  if (url.pathname.indexOf('config.local.js') !== -1 || /\/\./.test(url.pathname)) { return; }
  if (!ASSETS.some(function (asset) { return new URL(asset, self.registration.scope).href === url.href; })) { return; }

  // Utamakan jaringan agar pembaruan aplikasi langsung terpakai; cache hanya untuk keadaan offline.
  event.respondWith(
    fetch(request, { cache: 'no-cache' }).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, copy); }).catch(function () {}));
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error());
      });
    })
  );
});

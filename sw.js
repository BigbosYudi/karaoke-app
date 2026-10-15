var CACHE_NAME = 'karaoke-tv-v2';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/config.js',
  './js/queue.js',
  './js/search.js',
  './js/player.js',
  './js/lyrics.js',
  './js/mic.js',
  './js/guide.js',
  './js/app.js',
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
      return cache.addAll(ASSETS).catch(function () { /* sebagian aset opsional */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_NAME;
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
  if (url.pathname.indexOf('config.local.js') !== -1) { return; }

  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        return cached || caches.match('./index.html');
      });
      return cached || network;
    })
  );
});

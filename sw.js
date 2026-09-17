var CACHE = 'xionlive-v1';
var SHELL = ['/', '/index.html', '/hls.min.js', '/js/match-parser.js', '/js/xion-resolver.js', '/manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(names) {
    return Promise.all(names.filter(function(n) { return n !== CACHE; }).map(function(n) { return caches.delete(n); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname !== location.hostname) {
    return;
  }
  e.respondWith(caches.match(e.request).then(function(r) {
    return r || fetch(e.request).then(function(resp) {
      if (resp.ok && e.request.method === 'GET') {
        var clone = resp.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      }
      return resp;
    });
  }).catch(function() {
    return caches.match('/index.html');
  }));
});

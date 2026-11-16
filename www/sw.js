// 오프라인 캐시 (버전이 바뀌면 새로 받음)
const CACHE = 'star-v0.2.1';
const FILES = ['./', 'index.html', 'css/style.css', 'js/boot.js', 'js/main.js', 'js/game.js', 'js/ui.js', 'js/data.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
// 네트워크 우선, 실패하면 캐시
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});

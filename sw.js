// Bienenbuch – Service Worker (Offline-Cache)
// Cached NUR eigene Dateien + Firebase-Bibliothek. Datenbank-Verbindungen werden nie angefasst.
const CACHE = 'bienenbuch-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const eigen = url.origin === self.location.origin;
  const firebaseLib = url.href.startsWith('https://www.gstatic.com/firebasejs/');
  if (!eigen && !firebaseLib) return; // alles andere (Firestore, Login, GitHub) geht direkt ins Netz

  // Cache zuerst, im Hintergrund aktualisieren
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: eigen });
    const net = fetch(req).then(res => {
      if (res && res.ok) cache.put(eigen ? url.pathname : req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  }));
});

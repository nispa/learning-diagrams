// Fa funzionare il corso anche senza connessione, una volta aperto.
// Rete prima di tutto: online si vede sempre l'ultima versione; offline si usa la copia salvata.
// Un file nuovo dell'app va aggiunto a FILES (npm test controlla che ci sia ogni file caricato da index.html).
const CACHE = 'diagrammi-passo-passo';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'src/i18n/it.js',
  'src/i18n/en.js',
  'src/core/util.js',
  'src/core/expr.js',
  'src/core/flow.js',
  'src/core/interpreter.js',
  'src/core/checker.js',
  'src/core/render.js',
  'src/levels/it/levels.js',
  'src/levels/en/levels.js',
  'src/core/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((res) => {
    // si tengono anche i font di Google (risposte opache): senza rete restano quelli già visti
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (e.request.mode === 'navigate' ? caches.match('index.html') : r))));
});

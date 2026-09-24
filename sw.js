// v12: setup gate removed; session page starts empty. v10: install bypasses the HTTP cache (cache:'reload') so a new cache name can never be filled with a stale shell.
const CACHE_NAME = 'netflick-shell-v12';
const SHELL = ['./','index.html','styles.css','carpe-kit.css','carpe-kit.js','fonts/ibm-plex-sans-latin-400-normal.woff2','fonts/ibm-plex-sans-latin-400-italic.woff2','fonts/ibm-plex-sans-latin-600-normal.woff2','fonts/ibm-plex-sans-latin-700-normal.woff2','fonts/ibm-plex-sans-condensed-latin-600-normal.woff2','fonts/ibm-plex-sans-condensed-latin-700-normal.woff2','fonts/ibm-plex-mono-latin-400-normal.woff2','fonts/ibm-plex-mono-latin-500-normal.woff2','fonts/ibm-plex-mono-latin-700-normal.woff2','fonts/literata-latin-600-normal.woff2','app.js','engine.js','manifest.json','icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'}))))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.includes('/api/')) return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => { const copy=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)); return r; })));
});
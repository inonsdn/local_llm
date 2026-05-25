// Minimal service worker: app-shell cache + network-first for everything else.
// Bump CACHE_VERSION whenever you ship a breaking shell change.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const SHELL_ASSETS = ['/', '/login', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Never cache POST/PUT/DELETE or API routes — chat traffic must always be live.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful GETs for static-ish assets only.
        if (res.ok && (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/'))) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached ?? caches.match('/'))),
  );
});

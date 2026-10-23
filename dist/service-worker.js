const CACHE = 'ielts-cards-__BUILD_VERSION__';
const SHELL = ['./','index.html','styles.css','app.js','book-data.js','entry-renderer.js','desktop-settings.js','web-install.js','manifest.webmanifest','assets/cover.webp','assets/app-icon-192.png','assets/app-icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ielts-cards-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const url = new URL(event.request.url);
    if (url.pathname.includes('/assets/')) {
      const existing = await cache.match(event.request); if (existing) return existing;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return await cache.match(event.request, {ignoreSearch:true}) || (event.request.mode === 'navigate' ? await cache.match('index.html') : null) || new Response('尚未缓存，请联网后重试。',{status:503});
    }
  })());
});

/* App-shell-only cache. API requests are deliberately never intercepted. */
const CACHE = 'magnus-shell-v2'
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new URL('./', self.registration.scope))))
  self.skipWaiting()
})
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/exec')) return
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(event.request)
    if (cached) return cached
    const response = await fetch(event.request)
    if (response.ok) cache.put(event.request, response.clone())
    return response
  }))
})

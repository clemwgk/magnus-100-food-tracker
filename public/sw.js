/* App-shell-only cache. API requests are deliberately never intercepted. */
const CACHE = 'magnus-shell-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new URL('./', self.registration.scope))))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]))
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/exec')) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const response = await fetch(event.request)
      if (response.ok) await cache.put(event.request, response.clone())
      return response
    } catch (error) {
      const cached = await cache.match(event.request)
      if (cached) return cached
      throw error
    }
  })())
})

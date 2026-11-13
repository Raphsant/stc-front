/* STC Control — service worker
 *
 * Lo justo para que la app sea instalable y abra rápido, sin arriesgar datos:
 *  - NUNCA cachea /api ni el HTML de las páginas (datos de miembros tras login).
 *  - Cachea solo recursos con hash de la build (/_nuxt/*) e iconos: no cambian
 *    bajo el mismo nombre, así que nunca quedan desactualizados.
 *  - Sin conexión, las navegaciones muestran /offline.html.
 *
 * La versión llega en la URL de registro (/sw.js?v=x.y.z); cada despliegue
 * crea cachés nuevas y borra las anteriores al activarse.
 */

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const STATIC_CACHE = `stc-static-${VERSION}`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/brand/stc-mark.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('stc-') && k !== STATIC_CACHE).map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  )
})

function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false
  if (url.pathname.startsWith('/_nuxt/builds/')) return false // manifiesto de versión de Nuxt: siempre de red
  return url.pathname.startsWith('/_nuxt/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/brand/')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return

  // Navegaciones: siempre de red; si no hay conexión, la página offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    )
    return
  }

  // Recursos con hash e iconos: caché primero, red como respaldo.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok && res.type === 'basic') cache.put(request, res.clone())
        return res
      }),
    )
  }
  // Todo lo demás: comportamiento normal del navegador.
})

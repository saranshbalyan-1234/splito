/*
 * Splito's service worker (ARCHITECTURE 26.21, F-1901). Production web only:
 * `scripts/pwa.ts` runs after `expo export` and writes dist/sw.js as
 *   self.__PRECACHE = {name, urls: [[url, revision | null], ...]}
 * followed by this file. Dev and e2e builds never get a sw.js, and the app
 * never registers one there.
 *
 *  - The hashed shell and assets are precached at install. Navigations are
 *    answered with the cached shell (index.html), so any route opens offline.
 *  - Fonts and images that are not in the precache are served stale while
 *    revalidating.
 *  - Everything else, API routes first of all, goes straight to the network
 *    and is never stored: data lives in IndexedDB (ARCHITECTURE 9).
 *  - A new version installs in the background and waits. The page shows
 *    "New version available · Reload" and sends SKIP_WAITING when asked; the
 *    worker never takes over on its own.
 */
'use strict'

const PRECACHE = (typeof self !== 'undefined' && self.__PRECACHE) || {name: 'none', urls: []}
const PRECACHE_PREFIX = 'splito-precache-'
const CURRENT = PRECACHE_PREFIX + PRECACHE.name
const RUNTIME = 'splito-runtime'
const SHELL = '/index.html'
const PRECACHED = new Set(PRECACHE.urls.map(([url]) => url))

/**
 * How a request is answered: 'network' (untouched, never cached), 'navigate'
 * (the cached shell), 'precache' (cache first) or 'swr' (stale while
 * revalidate). The one place that decides what may reach a cache.
 */
function classify({method, mode, destination, url}, origin, precached) {
  const u = new URL(url)
  if (method !== 'GET' || u.origin !== origin) return 'network'
  if (u.pathname.startsWith('/api/')) return 'network'
  if (mode === 'navigate') return 'navigate'
  if (precached.has(u.pathname)) return 'precache'
  if (destination === 'font' || destination === 'image') return 'swr'
  return 'network'
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {classify}
} else {
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CURRENT).then(cache => Promise.all(PRECACHE.urls.map(([url, revision]) => precache(cache, url, revision)))),
    )
  })

  /* Hashed names never change, so the HTTP cache may serve them; the rest are re-fetched. */
  async function precache(cache, url, revision) {
    const response = await fetch(new Request(url, {cache: revision ? 'reload' : 'default'}))
    if (!response.ok) throw new Error(url + ' answered ' + response.status)
    /* A navigation may not be answered with a redirected response (a host that redirects /index.html to /). */
    await cache.put(
      url,
      response.redirected ? new Response(await response.blob(), {status: 200, headers: response.headers}) : response,
    )
  }

  self.addEventListener('activate', event => {
    event.waitUntil(
      (async () => {
        /* Keep the newest older precache: a tab still on the last version loads its lazy chunks from it. */
        const older = (await caches.keys()).filter(n => n.startsWith(PRECACHE_PREFIX) && n !== CURRENT)
        await Promise.all(older.slice(0, -1).map(n => caches.delete(n)))
        await self.clients.claim()
      })(),
    )
  })

  self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
  })

  self.addEventListener('fetch', event => {
    const request = event.request
    const kind = classify(request, self.location.origin, PRECACHED)
    if (kind === 'network') return
    event.respondWith(
      kind === 'navigate' ? shell(request) : kind === 'precache' ? precacheFirst(request) : staleWhileRevalidate(event),
    )
  })

  async function shell(request) {
    const cache = await caches.open(CURRENT)
    return (await cache.match(SHELL)) || fetch(request)
  }

  async function precacheFirst(request) {
    const cache = await caches.open(CURRENT)
    return (await cache.match(request)) || (await caches.match(request)) || fetch(request)
  }

  /* ponytail: no entry cap; same-origin fonts and images are few, add an LRU trim if that changes. */
  async function staleWhileRevalidate(event) {
    const request = event.request
    const cache = await caches.open(RUNTIME)
    const cached = await cache.match(request)
    const fresh = fetch(request).then(response => {
      if (response.ok) void cache.put(request, response.clone())
      return response
    })
    if (!cached) return fresh
    event.waitUntil(fresh.catch(() => {}))
    return cached
  }
}

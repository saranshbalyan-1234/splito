/*
 * Production web post-step (ARCHITECTURE 26.21, F-1901): after `expo export -p web`,
 * writes <dist>/sw.js = the precache manifest + web/sw.js.
 *
 *   node scripts/pwa.ts [dist]      (default: dist)
 *
 * Every exported file is precached except the worker itself and files the app
 * never loads. Fails when the export holds any demo mode code. Hashed names (Metro's 32-hex content hash) carry their own
 * version; the rest are versioned by a content hash. `pnpm e2e:build` and dev
 * never run this, so they never get a service worker.
 */
import {createHash} from 'node:crypto'
import {readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['/sw.js', '/metadata.json', '/fonts/OFL.txt'])
const HASHED = /[.-][0-9a-f]{32}(?=[.@])/

export type Precache = {name: string; urls: Array<[string, string | null]>}

/** The precache manifest for exported files (url path and bytes); `name` changes with any file. */
export function buildPrecache(files: Array<{url: string; bytes: Uint8Array}>): Precache {
  const urls = files
    .filter(f => !SKIP.has(f.url))
    .map((f): [string, string | null] => [f.url, HASHED.test(f.url) ? null : sha(f.bytes)])
    .sort(([a], [b]) => (a < b ? -1 : 1))
  const name = sha(Buffer.from(JSON.stringify(urls)))
  return {name, urls}
}

/*
 * Demo mode ships in every build (owner 148) but only as lazy chunks: the scripts index.html loads at start-up
 * must hold none of its seed or database. These strings are in the demo database's name and its seed.
 */
const DEMO_MARKERS = ['splito-demo', 'demo-large-']

/** Start-up scripts (the ones index.html loads) whose bytes hold demo data: empty in a good build. */
export function demoLeaks(files: Array<{url: string; bytes: Uint8Array}>): string[] {
  const html = Buffer.from(files.find(f => f.url === '/index.html')?.bytes ?? new Uint8Array()).toString('utf8')
  const entry = new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]))
  return files
    .filter(f => entry.has(f.url) && DEMO_MARKERS.some(m => Buffer.from(f.bytes).includes(m)))
    .map(f => f.url)
}

function sha(bytes: Uint8Array) {
  return createHash('sha1').update(bytes).digest('hex').slice(0, 12)
}

function walk(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
}

if (import.meta.main) {
  const dist = join(ROOT, process.argv[2] ?? 'dist')
  const files = walk(dist).map(p => ({url: '/' + relative(dist, p).split('\\').join('/'), bytes: readFileSync(p)}))
  if (!files.some(f => f.url === '/index.html')) throw new Error(`${dist} has no index.html: run expo export first`)
  const leaks = demoLeaks(files)
  if (leaks.length) throw new Error(`demo data is in the start-up bundle: ${leaks.join(', ')}`)
  const precache = buildPrecache(files)
  writeFileSync(join(dist, 'sw.js'), `self.__PRECACHE = ${JSON.stringify(precache)};\n${readFileSync(join(ROOT, 'web/sw.js'), 'utf8')}`)
  console.log(`sw.js: ${precache.urls.length} files precached (${precache.name})`)
}

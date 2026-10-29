import {describe, expect, test} from 'bun:test'

import {buildPrecache, demoLeaks} from '../../../scripts/pwa'
import {classify} from '../../../web/sw.js'
import {isIosDevice} from './state'
import {hasWorkAtStake, markWorkAtStake} from './workAtStake'

const ORIGIN = 'https://splito.test'
const PRECACHED = new Set(['/index.html', '/_expo/static/js/web/index-abc.js'])
const req = (
  url: string,
  extra: Partial<{method: string; mode: string; destination: string}> = {},
) => ({method: 'GET', mode: 'no-cors', destination: '', url: ORIGIN + url, ...extra})
const kind = (...args: Parameters<typeof req>) => classify(req(...args), ORIGIN, PRECACHED)

describe('service worker routing', () => {
  test('every navigation gets the cached shell, deep routes included', () => {
    expect(kind('/', {mode: 'navigate'})).toBe('navigate')
    expect(kind('/group/abc/balances', {mode: 'navigate'})).toBe('navigate')
  })

  test('precached files are served from the precache', () => {
    expect(kind('/_expo/static/js/web/index-abc.js')).toBe('precache')
  })

  test('fonts and images outside the precache are stale-while-revalidate', () => {
    expect(kind('/img/other.png', {destination: 'image'})).toBe('swr')
    expect(kind('/fonts/x.woff2', {destination: 'font'})).toBe('swr')
  })

  test('API routes never reach a cache, whatever they are', () => {
    for (const mode of ['navigate', 'cors', 'no-cors', 'same-origin']) {
      for (const destination of ['', 'image', 'font', 'document']) {
        expect(kind('/api/v1/sync/push', {mode, destination})).toBe('network')
      }
    }
    expect(classify({...req('/api/x'), method: 'POST'}, ORIGIN, PRECACHED)).toBe('network')
  })

  test('writes and other origins are left alone', () => {
    expect(kind('/index.html', {method: 'POST'})).toBe('network')
    expect(classify(req('/a.png', {destination: 'image'}), 'https://other.test', PRECACHED)).toBe('network')
    expect(kind('/anything.json', {mode: 'cors'})).toBe('network')
  })
})

describe('precache manifest', () => {
  const file = (url: string, text: string) => ({url, bytes: new TextEncoder().encode(text)})

  test('hashed names carry no revision, others a content hash; the worker is skipped', () => {
    const {urls} = buildPrecache([
      file('/index.html', 'a'),
      file('/_expo/static/js/web/index-a94410b5ccee5fc7f9fbbebd3b87297c.js', 'js'),
      file('/assets/f.2bf3d951bf9d6109437ea0874bbf12fb.woff2', 'f'),
      file('/sw.js', 'x'),
      file('/metadata.json', '{}'),
    ])
    expect(urls.map(([u]) => u)).toEqual([
      '/_expo/static/js/web/index-a94410b5ccee5fc7f9fbbebd3b87297c.js',
      '/assets/f.2bf3d951bf9d6109437ea0874bbf12fb.woff2',
      '/index.html',
    ])
    expect(urls.map(([, r]) => r !== null)).toEqual([false, false, true])
  })

  test('the cache name changes when any file changes', () => {
    const a = buildPrecache([file('/index.html', 'one')]).name
    expect(buildPrecache([file('/index.html', 'one')]).name).toBe(a)
    expect(buildPrecache([file('/index.html', 'two')]).name).not.toBe(a)
  })
})

describe('install and update helpers', () => {
  test('iPhone and iPad are told to Add to Home Screen; Chrome desktop is not', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', 'iPhone', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome', 'MacIntel', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 5)).toBe(false)
  })

  test('unsaved input is work at stake until it clears', () => {
    expect(hasWorkAtStake()).toBe(false)
    markWorkAtStake('sheet', true)
    expect(hasWorkAtStake()).toBe(true)
    markWorkAtStake('sheet', false)
    expect(hasWorkAtStake()).toBe(false)
  })
})

describe('demo mode ships only as lazy chunks (owner 148)', () => {
  const file = (url: string, text: string) => ({url, bytes: new TextEncoder().encode(text)})
  const html = file('/index.html', '<html><script src="/a.js" defer></script><script src="/c.js"></script></html>')
  test('a start-up script naming the demo database or its seed is reported', () => {
    expect(demoLeaks([html, file('/a.js', 'openStore(n,"splito-demo")'), file('/c.js', 'plain')])).toEqual(['/a.js'])
  })
  test('a lazy chunk holding the demo is fine', () => {
    expect(demoLeaks([html, file('/a.js', 'plain'), file('/c.js', 'plain'), file('/lazy.js', 'title:"The Supper Factory"')])).toEqual([])
  })
  test('the demo id shape in a start-up script is not a leak (the link resolver checks it, F-254)', () => {
    expect(demoLeaks([html, file('/a.js', '/^(demo-large-[a-z0-9-]{1,48})$/i'), file('/c.js', 'plain')])).toEqual([])
  })
})

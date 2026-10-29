import {appendFileSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

/*
 * The production build: the only one that registers the service worker. Production has no dev sign-in (F-250), so
 * these specs run on the signed-out app: a fresh install shows the intro at every address, offline included.
 */
const SW_FILE = join(__dirname, '../dist-pwa/sw.js')

async function controlled(page: Page) {
  await page.goto('/settings')
  await expect(page.getByTestId('welcome')).toBeVisible()
  // The worker installs, activates and claims this page.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
}

test('registers the worker and precaches the shell and hashed assets', async ({page}) => {
  await controlled(page)
  const cached = await page.evaluate(async () => {
    const names = await caches.keys()
    const urls: string[] = []
    for (const name of names) for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname)
    return {names, urls}
  })
  expect(cached.names.some(n => n.startsWith('splito-precache-'))).toBe(true)
  expect(cached.urls).toContain('/index.html')
  expect(cached.urls.some(u => /^\/_expo\/static\/js\/web\/index-[0-9a-f]{32}\.js$/.test(u))).toBe(true)
  expect(cached.urls).toContain('/manifest.json')
})

test('opens offline, refreshing a deep route included', async ({page, context}) => {
  await controlled(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('welcome')).toBeVisible()
  await page.goto('/settings/about')
  await expect(page.getByTestId('welcome')).toBeVisible()
  await page.getByTestId('welcome-skip').click()
  await expect(page.getByTestId('continue-form')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('continue-form')).toBeVisible()
  await context.setOffline(false)
})

test('API routes never reach a cache', async ({page}) => {
  await controlled(page)
  await page.evaluate(() => fetch('/api/v1/sync/pull').catch(() => null))
  const urls = await page.evaluate(async () => {
    const out: string[] = []
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(r.url)
    return out
  })
  expect(urls.filter(u => new URL(u).pathname.startsWith('/api/'))).toEqual([])
  // Offline the request fails: no cached copy answers.
  await page.context().setOffline(true)
  const outcome = await page.evaluate(() => fetch('/api/v1/sync/pull').then(() => 'answered', () => 'failed'))
  await page.context().setOffline(false)
  expect(outcome).toBe('failed')
})

/* The update toast is `PwaHost`'s, which lives in the signed-in app (it reads the install-hint preference). A production build has no dev sign-in, so this runs by hand once the auth API exists (docs/RELEASE_CHECKLIST.md). */
test.skip('a new version shows the toast and Reload switches to it', async ({page}) => {
  await controlled(page)
  const original = readFileSync(SW_FILE, 'utf8')
  try {
    // Different bytes make the browser install a new worker beside the running one.
    appendFileSync(SW_FILE, '\n// next version\n')
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      await reg?.update()
    })
    const reload = page.getByTestId('update-reload')
    await expect(reload).toBeVisible()
    await expect(page.getByText('New version available')).toBeVisible()
    // Nothing reloaded on its own.
    await page.waitForTimeout(500)
    await expect(page.getByTestId('screen-settings')).toBeVisible()
    await Promise.all([page.waitForEvent('load'), reload.click()])
    await expect(page.getByTestId('screen-settings')).toBeVisible()
    await expect(page.getByTestId('update-reload')).toHaveCount(0)
    expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain('/sw.js')
  } finally {
    writeFileSync(SW_FILE, original)
  }
})

test('the manifest is standalone with the Dim background and brand icons', async ({page}) => {
  await page.goto('/')
  const manifest = await page.evaluate(() => fetch('/manifest.json').then(r => r.json()))
  expect(manifest).toMatchObject({display: 'standalone', background_color: '#151D28', short_name: 'Splito'})
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
})

test('production has no dev sign-in: no dev account, and Continue says sign-in arrives with sync', async ({page}) => {
  await page.goto('/')
  await page.getByTestId('welcome-skip').click()
  await expect(page.getByTestId('continue-form')).toBeVisible()
  await expect(page.getByTestId('continue-dev-account')).toHaveCount(0)
  await expect(page.getByTestId('dev-banner')).toHaveCount(0)
  await page.getByTestId('continue-input').fill('dev@splito.test')
  await page.getByTestId('continue-next').click()
  await expect(page.getByTestId('continue-error')).toContainText('arrives with sync')
  expect(await page.evaluate(() => (window as unknown as {__splitoTest?: unknown}).__splitoTest)).toBeUndefined()
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0)
})

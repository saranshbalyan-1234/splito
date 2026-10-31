import {appendFileSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

/*
 * The PREVIEW build (`EXPO_PUBLIC_ENV=preview`, what Render serves for the owner's review; a production build is refused
 * until the auth HTTP client exists): like production it registers the service worker, and it offers the labelled dev account,
 * which is how these specs get in. A fresh install starts at the intro, then Continue.
 */
const SW_FILE = join(__dirname, '../dist-pwa/sw.js')

/** Signs in through the real Continue screen (the preview build has no test hooks), then opens Settings. */
async function controlled(page: Page) {
  await page.goto('/')
  await page.getByTestId('welcome-skip').click()
  await page.getByTestId('continue-dev-account').click()
  await expect(page.getByTestId('screen-people')).toBeVisible({timeout: 20_000})
  await page.goto('/profile')
  await expect(page.getByTestId('screen-profile')).toBeVisible()
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
  await expect(page.getByTestId('screen-profile')).toBeVisible()
  await page.goto('/settings/about')
  await expect(page.getByTestId('screen-settings-section')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
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

test('a new version shows the toast and Reload switches to it', async ({page}) => {
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
    await expect(page.getByTestId('screen-profile')).toBeVisible()
    await Promise.all([page.waitForEvent('load'), reload.click()])
    await expect(page.getByTestId('screen-profile')).toBeVisible()
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

test('the preview build says so on Continue, is not indexed, and has the labelled dev account', async ({page}) => {
  await page.goto('/')
  await page.getByTestId('welcome-skip').click()
  await expect(page.getByTestId('preview-note')).toContainText("Preview build: local dev account, data stays in this browser, don't use a real password")
  await expect(page.getByTestId('continue-dev-account')).toContainText('Continue with a dev account')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  // No test hooks, and no database before sign-in.
  expect(await page.evaluate(() => Object.keys((window as unknown as {__splitoTest?: object}).__splitoTest ?? {}).filter(k => ['signIn', 'signOut', 'seedAccount', 'seedLegacy', 'demoMode', 'openLink'].includes(k)))).toEqual([])
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0)
})

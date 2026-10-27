import {type Page} from '@playwright/test'

type Hooks = {__splitoTest?: {demoMode?: (on: boolean) => Promise<void>}}

/**
 * Opens the app in demo mode (ARCHITECTURE 26.1, F-228a): the one demo dataset
 * in its own database, switched on through the e2e hook that runs the same
 * switch as Settings > Data > Demo mode. With a `path`, that page is loaded
 * afterwards, which also shows that a reload keeps the mode.
 */
export async function openDemo(page: Page, path = '/') {
  // Already in the app (a test that moves between pages): the hook is there; otherwise load it first.
  if (!page.url().startsWith('http')) await page.goto('/')
  await page.waitForFunction(() => !!(window as unknown as Hooks).__splitoTest?.demoMode, undefined, {timeout: 30_000})
  await page.evaluate(() => (window as unknown as Hooks).__splitoTest!.demoMode!(true))
  if (path !== '/' || page.url() !== new URL('/', page.url()).href) await page.goto(path)
  // The app's seeding tools are bound to the new store once it is showing.
  await page.waitForFunction(() => 'splito' in window, undefined, {timeout: 30_000})
}

/** Turns demo mode off again through the same hook (back on the real, untouched data). */
export async function closeDemo(page: Page) {
  await page.evaluate(() => (window as unknown as Hooks).__splitoTest!.demoMode!(false))
}

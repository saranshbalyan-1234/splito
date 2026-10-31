import {type Page} from '@playwright/test'

/**
 * Loads `path` and waits until the app has installed its seeding tools (`window.splito`, dev and E2E builds only),
 * which means the store is open. Specs that seed through `window.splito` start here; demo specs use `openDemo`.
 */
export async function openApp(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForFunction(() => 'splito' in window)
}

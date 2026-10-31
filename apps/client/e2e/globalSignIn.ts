import {dirname, resolve} from 'node:path'

import {chromium, type FullConfig} from '@playwright/test'

type Hooks = {__splitoTest?: {signIn?: () => void}}

/**
 * Sign-in is required (ARCHITECTURE 26.15, F-250), so every spec starts inside the app: this runs once per config, signs the
 * dev account in through `window.__splitoTest.signIn()` and saves the browser state, which the config hands to every
 * test (`use.storageState`). A spec that tests the signed-out app starts from `signedOut` instead.
 */
export default async function globalSignIn(config: FullConfig) {
  const {baseURL, storageState: relative} = config.projects[0]!.use
  if (typeof relative !== 'string' || !baseURL) throw new Error('globalSignIn needs use.baseURL and use.storageState')
  const storageState = resolve(dirname(config.configFile ?? ''), relative)
  const browser = await chromium.launch({channel: 'chrome'})
  try {
    const page = await browser.newPage({baseURL})
    await page.goto('/', {timeout: 240_000})
    await page.waitForFunction(() => !!(window as unknown as Hooks).__splitoTest?.signIn, undefined, {timeout: 240_000})
    await page.evaluate(() => (window as unknown as Hooks).__splitoTest!.signIn!())
    /* Saved only once the app is up on the account's own database, so every test starts from a state that opens. */
    await page.getByTestId('screen-people').locator('visible=true').first().waitFor({timeout: 240_000})
    await page.context().storageState({path: storageState})
  } finally {
    await browser.close()
  }
}

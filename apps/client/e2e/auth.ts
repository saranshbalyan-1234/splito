import {expect, type Page} from '@playwright/test'

type Hooks = {
  __splitoTest?: {
    signIn?: () => void
    signOut?: () => void
    seedAccount?: (a: {name: string; email?: string; phone?: string; password?: string}) => void
    seedLegacy?: (names: string[]) => Promise<void>
  }
}

export const DEV = {email: 'dev@splito.test', password: 'devpassword'}

/** Names of the IndexedDB databases the page has open or has made. */
export const databases = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map(d => d.name).sort())

/** Signed-out specs: past the intro, on the Continue screen (the intro has its own spec). */
export async function toContinue(page: Page, path = '/') {
  await page.goto(path)
  /* Either the intro (a fresh install) or the Continue screen: wait for whichever comes, then get past the intro. */
  await expect(page.getByTestId('welcome-skip').or(page.getByTestId('continue-form'))).toBeVisible()
  if (await page.getByTestId('welcome-skip').isVisible()) await page.getByTestId('welcome-skip').click()
  await expect(page.getByTestId('continue-form')).toBeVisible()
}

/** The one-time code the dev AuthClient "sent", from the dev banner. */
export async function devCode(page: Page) {
  const code = page.getByTestId('dev-code')
  await expect(code).toHaveText(/^\d{6}$/)
  return (await code.textContent())!
}

/** Types the contact on the Continue screen and presses Continue. */
export async function continueWith(page: Page, contact: string) {
  await page.getByTestId('continue-input').fill(contact)
  await page.getByTestId('continue-next').click()
}

/** An existing account signs in with its password. */
export async function signInWithPassword(page: Page, contact: string, password: string) {
  await continueWith(page, contact)
  await expect(page.getByTestId('credential-form')).toBeVisible()
  const tab = page.getByTestId('method-password')
  if ((await tab.getAttribute('aria-checked')) !== 'true') await tab.click()
  await page.getByTestId('credential-password').fill(password)
  await page.getByTestId('credential-next').click()
}

/** A new account, end to end through the dev client: contact, verify, name, the other contact, verify, password. */
export async function createAccount(page: Page, a: {email: string; phone: string; name: string; password: string}) {
  await continueWith(page, a.email)
  await expect(page.getByTestId('code-form')).toBeVisible()
  await page.getByTestId('code-input').fill(await devCode(page))
  await page.getByTestId('code-next').click()
  await page.getByTestId('name-input').fill(a.name)
  await page.getByTestId('name-next').click()
  await page.getByTestId('other-input').fill(a.phone)
  await page.getByTestId('other-next').click()
  await expect(page.getByTestId('code-form')).toBeVisible()
  await expect(page.getByTestId('dev-code')).toContainText(/\d{6}/)
  await page.getByTestId('code-input').fill(await devCode(page))
  await page.getByTestId('code-next').click()
  await page.getByTestId('newPasswordInput').fill(a.password)
  await page.getByTestId('setNewPassword-next').click()
}

export const signedInShown = (page: Page) => expect(page.getByTestId('screen-home')).toBeVisible({timeout: 20_000})

export const hooks = (page: Page) => page.evaluate(() => Object.keys((window as unknown as Hooks).__splitoTest ?? {}))

/** Settings > Log out, confirmed: everything the account left on the device is erased, then the logged-out flow shows (owner 186). */
export const logOutFromSettings = async (page: Page) => {
  await page.goto('/settings')
  await page.getByTestId('settings-log-out').click()
  await page.getByTestId('logout-confirm').click()
  await expect(page.getByTestId('continue-form')).toBeVisible({timeout: 30_000})
}

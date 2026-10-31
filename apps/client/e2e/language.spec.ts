import {expect, type Page, test} from '@playwright/test'

import {toContinue} from './auth'
import {openDemo} from './openDemo'
import {signedOut} from './signedOut'

/*
 * F-1816: Bluesky's AppLanguageDropdown on the logged-out Continue screen and the desktop right
 * column. Signed in it writes the `language` preference (the same value as Settings > Language);
 * signed out there is no database, so it is the device's choice, which the account takes at its first
 * sign-in. Either way the catalog switches live, with no reload.
 */
const WIDE = {width: 1440, height: 900}
const LAPTOP = {width: 1280, height: 800}
const PHONE = {width: 390, height: 844}

/* The logged-out Continue screen of a fresh install (the specs that start signed out opt out of the shared sign-in). */
async function openSplash(page: Page) {
  await toContinue(page)
  await expect(page.getByTestId('continue-form')).toBeVisible()
}

test.describe('signed out', () => {
test.use(signedOut)

test('Continue screen: Hindi switches live, keeps across a reload and is the account\'s language after sign-in', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await openSplash(page)
  const dropdown = page.getByTestId('app-language')
  await expect(dropdown).toHaveAttribute(
    'aria-label',
    'App language, current: English',
  )
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  let loads = 0
  page.on('load', () => loads++)
  await dropdown.click()
  await page.getByTestId('app-language-hi').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByTestId('continue-next')).not.toContainText('Continue')
  await expect(dropdown).toContainText('हिन्दी')
  await expect(dropdown).toHaveAttribute(
    'aria-label',
    /App language, current: हिन्दी – Hindi|.*हिन्दी – Hindi/,
  )

  expect(loads).toBe(0)

  // The device keeps the choice while signed out.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByTestId('app-language')).toContainText('हिन्दी')
  // The account takes it at sign-in: Settings > Language agrees.
  await page.getByTestId('continue-dev-account').click()
  await expect(page.getByTestId('screen-people')).toBeVisible({timeout: 20_000})
  await page.goto('/settings/regional')
  await expect(page.getByTestId('language-hi')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
})

test('Continue screen: the dropdown is keyboard operable', async ({page}) => {
  await page.setViewportSize(LAPTOP)
  await openSplash(page)
  await page.getByTestId('app-language').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('app-language-hi')).toBeVisible()
  // Focus starts on the current option; arrows move it, Enter picks.
  await expect(page.getByTestId('app-language-en')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('app-language-hi')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
})
})

test('desktop right column: the dropdown switches the sidebar labels', async ({
  page,
}) => {
  await page.setViewportSize(WIDE)
  /* The right column is on every page; Groups here. */
  await openDemo(page, '/groups')
  await expect(page.getByTestId('screen-groups')).toBeVisible()
  await expect(page.getByTestId('tab-people')).toContainText('People')
  const dropdown = page.getByTestId('right-nav').getByTestId('app-language')
  await dropdown.click()
  await page.getByTestId('app-language-hi').click()
  await expect(page.getByTestId('tab-people')).toContainText('लोग')
  // Settings > Language is the same preference.
  await page.goto('/settings/regional')
  await expect(page.getByTestId('language-hi')).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test.describe('signed out, phone', () => {
test.use(signedOut)
test('phone width: the same select opens as a bottom sheet with the current option checked', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openSplash(page)
  await page.getByTestId('app-language').click()
  const hi = page.getByTestId('app-language-hi')
  const en = page.getByTestId('app-language-en')
  await expect(hi).toBeVisible()
  // Checked by a radio mark and by its state, not by colour alone.
  await expect(en).toHaveAttribute('aria-checked', 'true')
  await expect(hi).toHaveAttribute('aria-checked', 'false')
  // The sheet slides up and its list settles; click once it has.
  await page.waitForTimeout(800)
  await hi.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
})
})

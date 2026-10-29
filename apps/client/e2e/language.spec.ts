import {expect, type Page, test} from '@playwright/test'

/*
 * F-1816: Bluesky's AppLanguageDropdown on the web sign-in splash, sign-up and the desktop right
 * column. It writes the `language` preference (the same value as Settings > Language) and switches
 * the catalog live, with no reload.
 */
const WIDE = {width: 1440, height: 900}
const LAPTOP = {width: 1280, height: 800}
const PHONE = {width: 390, height: 844}

async function openSplash(page: Page) {
  await page.goto('/settings')
  await page.getByTestId('settings-sign-in').click()
  await expect(page.getByTestId('createAccountButton')).toBeVisible()
}

test('web splash: Hindi switches the splash and sign-up live, keeps across a reload and equals Settings', async ({
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
  await expect(page.getByTestId('createAccountButton')).not.toContainText(
    'Create account',
  )
  await expect(dropdown).toContainText('हिन्दी')
  await expect(dropdown).toHaveAttribute(
    'aria-label',
    /App language, current: हिन्दी – Hindi|.*हिन्दी – Hindi/,
  )

  // Sign-up shows the same dropdown, in Hindi, under the form.
  await page.getByTestId('createAccountButton').click()
  await expect(page.getByTestId('createAccount')).toBeVisible()
  await expect(
    page.getByTestId('createAccount').getByTestId('app-language'),
  ).toContainText('हिन्दी')
  expect(loads).toBe(0)

  await page.reload()
  await page.goto('/settings/regional')
  await expect(page.getByTestId('language-hi')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
})

test('web splash: the dropdown is keyboard operable', async ({page}) => {
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

test('desktop right column: the dropdown switches the sidebar labels', async ({
  page,
}) => {
  await page.setViewportSize(WIDE)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await expect(page.getByTestId('tab-people')).toContainText('Home')
  const dropdown = page.getByTestId('right-nav').getByTestId('app-language')
  await dropdown.click()
  await page.getByTestId('app-language-hi').click()
  await expect(page.getByTestId('tab-people')).toContainText('घर')
  // Settings > Language is the same preference.
  await page.goto('/settings/regional')
  await expect(page.getByTestId('language-hi')).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('phone width: the same select opens as a bottom sheet with the current option checked', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openSplash(page)
  await page.getByTestId('createAccountButton').click()
  await page.getByTestId('createAccount').getByTestId('app-language').click()
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

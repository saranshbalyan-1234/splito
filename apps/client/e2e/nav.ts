import {expect, type Page} from '@playwright/test'

/**
 * Opens the side drawer. No swipe opens it (owner 216: iOS Safari's left-edge swipe is Back) and no button does, so
 * the drawer is reached by its address (`?drawer=menu`, F-241) at every width.
 */
export async function openDrawer(page: Page) {
  const url = new URL(page.url())
  url.searchParams.set('drawer', 'menu')
  await page.goto(url.toString())
  await expect(page.getByTestId('drawer')).toBeVisible()
}

/** The header avatar of the page showing opens Profile at every width (owner 201). */
export async function openProfile(page: Page) {
  await page.getByTestId('header-avatar').locator('visible=true').first().click()
  await expect(page.getByTestId('screen-profile')).toBeVisible()
}

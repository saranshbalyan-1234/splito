import {expect, type Page} from '@playwright/test'

/** The header avatar of the page showing opens Profile at every width (owner 201). */
export async function openProfile(page: Page) {
  await page.getByTestId('header-avatar').locator('visible=true').first().click()
  await expect(page.getByTestId('screen-profile')).toBeVisible()
}

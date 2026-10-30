import {expect, test} from '@playwright/test'

/* F-249: signed in, Settings > Help "See the intro" replays the slides; Skip and Get started go back to where it began. */
test('Help > See the intro replays the slides at /welcome/N and returns to Help', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto('/settings/help')
  await expect(page.getByTestId('screen-settings-section')).toBeVisible()
  await page.getByTestId('help-see-intro').click()
  await expect(page.getByTestId('screen-welcome')).toBeVisible()
  await expect(page).toHaveURL(/\/welcome\/1$/)
  await expect(page.getByTestId('welcome-title')).toHaveText('Split anything with anyone')
  await page.getByTestId('welcome-next').click()
  await expect(page).toHaveURL(/\/welcome\/2$/)
  await page.getByTestId('welcome-skip').click()
  await expect(page.getByTestId('screen-welcome')).toHaveCount(0)
  await expect(page).toHaveURL(/\/settings\/help$/)
  await expect(page.getByTestId('screen-settings-section')).toBeVisible()
})

test('a signed-in app never opens the intro by itself', async ({page}) => {
  await page.goto('/')
  await expect(page.getByTestId('screen-home')).toBeVisible()
  await expect(page.getByTestId('welcome')).toHaveCount(0)
})

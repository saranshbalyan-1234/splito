import {expect, test} from '@playwright/test'

/* A-014 / F-108: a link the app does not know opens People, never a blank page. */

test('an unknown path opens People and the address bar says /', async ({page}) => {
  await page.goto('/no/such/page')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('an unknown nested path under a real section opens People too', async ({page}) => {
  await page.goto('/groups/abc/settle/extra')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('a known path still opens its screen', async ({page}) => {
  await page.goto('/groups')
  await expect(page.getByTestId('screen-groups')).toBeVisible()
})

test('Back on a page opened directly never leaves a blank page', async ({page}) => {
  // Web keeps People under every deep-linked page (linking.web.ts), so Back lands there;
  // with no history at all (native cold start) goBack() uses the per-route parent (goBack.test.ts).
  await page.goto('/groups/nope')
  await page.getByTestId('header-back').click()
  await expect(page.getByTestId('screen-people')).toBeVisible()
})

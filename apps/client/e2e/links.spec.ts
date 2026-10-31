import {expect, test} from '@playwright/test'

/* A-014 / F-108: a link the app does not know opens People, never a blank page. */

test('an unknown path opens People and the address bar says /people', async ({page}) => {
  await page.goto('/no/such/page')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page).toHaveURL(/\/people$/)
})

test('an unknown nested path under a real section opens People too', async ({page}) => {
  await page.goto('/groups/abc/settle/extra')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page).toHaveURL(/\/people$/)
})

test('a known path still opens its screen', async ({page}) => {
  await page.goto('/groups')
  await expect(page.getByTestId('screen-groups')).toBeVisible()
})

test('Back on a page opened directly goes to its parent, never a blank page (audit M16)', async ({page}) => {
  // Web puts the page's parents under a deep link (linking.web.ts), so Back runs the per-route fallback:
  // Group -> Groups -> People.
  await page.goto('/groups/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77')
  await page.getByTestId('header-back').click()
  await expect(page.getByTestId('screen-groups')).toBeVisible()
})

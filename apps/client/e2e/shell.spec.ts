import {expect, test} from '@playwright/test'

test('People is the initial route with no People title', async ({page}) => {
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByRole('heading', {name: 'People'})).toHaveCount(0)
})

test('logo inactive on home, returns home elsewhere', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800})
  await page.goto('/groups')
  await page.getByTestId('logo').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('logo')).toHaveAttribute('aria-disabled', 'true')
})

test('desktop sidebar has + at bottom', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800})
  await page.goto('/')
  await expect(page.getByTestId('sidebar-add')).toBeVisible()
})

test('mobile has central +', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')
  await expect(page.getByTestId('tab-add')).toBeVisible()
})

test('deep link refresh works', async ({page}) => {
  await page.goto('/groups')
  await page.reload()
  await expect(page.getByTestId('screen-groups')).toBeVisible()
})

test('dev tools seed data in e2e builds', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  const id = await page.evaluate(() => (window as any).splito.createPerson('Riya'))
  expect(typeof id).toBe('string')
})

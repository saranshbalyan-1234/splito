import {expect, type Page, test} from '@playwright/test'

/*
 * F-243 (owner 110, ARCHITECTURE 26.8): alerts sit at the top right on rail and desktop and full
 * width at the top on phones, and every one has a round X. The update toast stands in: it is the
 * app's own toast, it holds an action (Reload) and stays until dismissed.
 */
type Splito = {setPwa(p: object): void}

async function showToast(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.setPwa({updateReady: true}))
  const toast = page.locator('[data-sonner-toast]').first()
  await expect(toast).toBeVisible()
  // Let the slide-in settle before measuring.
  await page.waitForTimeout(700)
  return toast
}

test('desktop: the toast stacks at the top right, below the header line, with a 44 px X beside its action', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  const toast = await showToast(page)
  const box = (await toast.boundingBox())!
  expect(box.x + box.width).toBeGreaterThan(1440 - 60)
  expect(box.x).toBeGreaterThan(1440 / 2)
  expect(box.y).toBeGreaterThanOrEqual(52)
  expect(box.y).toBeLessThan(120)
  const close = page.getByTestId('toast-close')
  await expect(close).toHaveAttribute('aria-label', 'Dismiss')
  const hit = (await close.boundingBox())!
  expect(hit.width).toBeGreaterThanOrEqual(44)
  expect(hit.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByTestId('update-reload')).toBeVisible()
  await close.click()
  await expect(page.getByTestId('update-reload')).toHaveCount(0)
})

test('phone: the toast sits at the top, full width inside the gutters, and the X closes it', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  const toast = await showToast(page)
  const box = (await toast.boundingBox())!
  expect(box.y).toBeLessThan(40)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(box.width).toBeGreaterThanOrEqual(390 - 2 * 24)
  await page.getByTestId('toast-close').click()
  await expect(page.getByTestId('update-reload')).toHaveCount(0)
})

test('phone: swiping the toast up dismisses it', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  const toast = await showToast(page)
  const box = (await toast.boundingBox())!
  const x = box.x + box.width / 2
  await page.mouse.move(x, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, box.y - 60, {steps: 8})
  await page.mouse.up()
  await expect(page.getByTestId('update-reload')).toHaveCount(0)
})

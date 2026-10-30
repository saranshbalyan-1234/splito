/** Phone drawers: the page behind is usable the moment a sheet starts to leave. */
import {expect, test} from '@playwright/test'

import {openDemo} from './openDemo'

test.describe('phone', () => {
test.use({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true})

test('typing into the page right after a sheet is closed is not lost to the exiting sheet', async ({page}) => {
  await openDemo(page, '/people')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('fab-add').click()
  await page.getByTestId('expense-title').fill('Race')
  await page.getByTestId('amount-input').fill('500')
  await page.getByTestId('split-mode-items').click()
  await page.getByTestId('item-add').click()
  await page.getByTestId('expense-people').click()
  await page.getByTestId('person-option-Riya Sharma').click()
  await page.getByTestId('people-dialog').getByTestId('sheet-close').click()
  // No waiting for the exit animation: the field is usable the moment the sheet starts to leave.
  const name = page.getByTestId('item-0-name')
  await name.click()
  /* Focus stays in the field for as long as the sheet takes to leave (a focus trap on the exiting sheet pulls it back). */
  const held = await page.evaluate(
    () =>
      new Promise<boolean[]>(resolve => {
        const out: boolean[] = []
        const t = setInterval(() => {
          out.push(document.activeElement?.getAttribute('data-testid') === 'item-0-name')
          if (out.length === 20) {
            clearInterval(t)
            resolve(out)
          }
        }, 25)
      }),
  )
  expect(held.every(Boolean)).toBe(true)
  await name.pressSequentially('Paneer Tikka', {delay: 40})
  await expect(name).toHaveValue('Paneer Tikka')
})
})

test.describe('desktop', () => {
  test.use({viewport: {width: 1440, height: 900}})

  test('Escape closes a popup and focus returns to the control that opened it', async ({page}) => {
    await openDemo(page, '/people')
    await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
    await page.getByTestId('sidebar-add').click()
    const opener = page.getByTestId('expense-people')
    await opener.click()
    await expect(page.getByTestId('people-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('people-dialog')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
      .toBe('expense-people')
  })
})

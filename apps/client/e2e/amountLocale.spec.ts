import {expect, type Page, test} from '@playwright/test'

import {type SplitoDevTools} from '../src/data/devTools'
import {openApp} from './app'
import {DESKTOP} from './viewports'

/*
 * F-111 (logic audit C1, C2): amounts the app writes into a field - the
 * Record payment and Call it even prefills, the Edit expense form - read
 * back as the same money in a comma-decimal number format, for a 3-decimal
 * currency (BHD). Seeds through window.splito (dev/E2E builds only); amounts
 * are minor units.
 */


/** Bob owes me BHD 1.234 (I paid 2.468, split equally), or `total` when given. */
async function seed(
  page: Page,
  numberLocale: 'en-US' | 'en-IN' | 'de-DE' | 'fr-FR',
  total = '2468',
): Promise<{bob: string; expense: string}> {
  await page.setViewportSize(DESKTOP)
  await openApp(page)
  return page.evaluate(
    async ({numberLocale, total}) => {
      const s = (window as unknown as {splito: SplitoDevTools}).splito
      await s.setPref('numberLocale', numberLocale)
      const bob = await s.createPerson('Bob Lee')
      const expense = await s.createExpense({
        title: 'Souq dinner',
        groupId: null,
        currency: 'BHD',
        total,
        payers: {[s.me]: total},
        split: {mode: 'equal', participants: [s.me, bob]},
        date: '2026-10-20',
        tz: 'Asia/Bahrain',
        category: 'food',
        notes: '',
      })
      return {bob, expense}
    },
    {numberLocale, total},
  )
}

async function openEdit(page: Page, expense: string) {
  await page.goto(`/expense/${expense}`)
  await page.getByTestId('expense-edit-button').click()
  await expect(page.getByTestId('screen-edit-expense')).toBeVisible()
}

test('C1: Record payment as offered settles a BHD balance exactly under de-DE', async ({
  page,
}) => {
  const {bob} = await seed(page, 'de-DE')
  await page.goto(`/people/${bob}`)
  await expect(page.getByTestId('person-total-BHD')).toHaveText('1,234 BHD')

  await page.getByTestId('person-record-payment').click()
  // The prefill is written in the format's own mark, and saved as offered.
  await expect(page.getByTestId('payment-amount')).toHaveValue('1,234')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('payment-recorded')).toBeVisible()
  await expect(page.getByTestId('person-settled')).toBeVisible()
  await expect(page.getByTestId('person-total-BHD')).toHaveCount(0)
})

test('C1: Call it even as offered clears a BHD balance under de-DE', async ({
  page,
}) => {
  const {bob} = await seed(page, 'de-DE')
  await page.goto(`/people/${bob}`)
  await page.getByTestId('person-more').click()
  await page.getByTestId('person-call-even').click()
  await expect(page.getByTestId('call-even-sheet')).toBeVisible()
  await expect(page.getByTestId('call-even-amount')).toHaveValue('1,234')
  await expect(page.getByTestId('sheet-save')).toBeEnabled()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('call-even-done')).toBeVisible()
  await expect(page.getByTestId('person-total-BHD')).toHaveCount(0)
})

test('C2: editing only the title of a BHD expense keeps its amount under de-DE', async ({
  page,
}) => {
  const {expense} = await seed(page, 'de-DE', '12345')
  await openEdit(page, expense)
  await expect(page.getByTestId('amount-input')).toHaveValue('12,345')
  await expect(page.getByTestId('amount-readings')).toHaveCount(0)
  await page.getByTestId('expense-title').fill('Souq dinner, all of us')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('screen-edit-expense')).toHaveCount(0)
  await expect(page.getByTestId('expense-detail-amount')).toHaveText(
    '12,345 BHD',
  )
})

test('C2: a BHD expense can be edited and saved under en-US without a "Did you mean"', async ({
  page,
}) => {
  const {expense} = await seed(page, 'en-US', '12345')
  await openEdit(page, expense)
  await expect(page.getByTestId('amount-input')).toHaveValue('12.345')
  await expect(page.getByTestId('amount-readings')).toHaveCount(0)
  await page.getByTestId('expense-title').fill('Souq dinner, all of us')
  await expect(page.getByTestId('sheet-save')).toBeEnabled()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('screen-edit-expense')).toHaveCount(0)
  await expect(page.getByTestId('expense-detail-amount')).toHaveText(
    'BHD 12.345',
  )
})

import {expect, type Page, test} from '@playwright/test'

import {composeButton, openAddExpense} from './composer'
import {openDemo} from './openDemo'
import {SIZES} from './viewports'

/*
 * F-273 (owner 207): Add expense always shows Paid by, and a new expense starts
 * with me as the payer from every entry point, at phone and desktop widths.
 * Scanned receipts (F-501) and Duplicate expense are not built yet; they have to
 * join this list when they land.
 */

/** Paid by is on screen and reads "You". */
async function expectPaidByMe(page: Page) {
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
  await expect(page.getByTestId('expense-payers')).toBeVisible()
  await expect(page.getByTestId('expense-payers')).toContainText('Paid by')
  await expect(page.getByTestId('expense-payers-value')).toHaveText('You')
}

for (const [name, size] of SIZES) {
  test.describe(`at ${name}`, () => {
    test.use({viewport: size})

    test('the FAB (phone) or the sidebar pill (desktop)', async ({page}) => {
      await openAddExpense(page, size)
      await expectPaidByMe(page)
    })

    test('a group page: the group is pre-selected and I am still the payer', async ({page}) => {
      await openDemo(page, '/groups')
      await page.getByTestId('group-Goa trip').click()
      await expect(page.getByTestId('screen-group')).toBeVisible()
      await page.getByTestId('group-add-expense').click()
      await expectPaidByMe(page)
      await expect(page.getByTestId('expense-group-value')).toContainText('Goa trip')
      await page.goBack()
      await composeButton(page, 'screen-group').click()
      await expectPaidByMe(page)
      await expect(page.getByTestId('expense-group-value')).toContainText('Goa trip')
    })

    test('a person page: the friend is pre-selected but I am the payer', async ({page}) => {
      await openDemo(page, '/people')
      await page.getByTestId('person-Riya Sharma').click()
      await expect(page.getByTestId('screen-person')).toBeVisible()
      await page.getByTestId('person-add-expense').click()
      await expectPaidByMe(page)
      await expect(page.getByTestId('expense-people-value')).toContainText('Riya')
      await page.goBack()
      await composeButton(page, 'screen-person').click()
      await expectPaidByMe(page)
      await expect(page.getByTestId('expense-people-value')).toContainText('Riya')
    })

    test('an Ask Splito prefill without a payer', async ({page}) => {
      await openDemo(page, '/people')
      await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
      await page.getByTestId('header-search-ask').click()
      await page.getByTestId('search-input').fill('split 1200 4 ways')
      await page.getByTestId('search-input').press('Enter')
      await expect(page.getByTestId('ask-chat')).toBeVisible()
      await page.getByTestId('ask-action-add').click()
      await expect(page.getByTestId('amount-input')).toHaveValue('1200.00')
      await expectPaidByMe(page)
    })

    test('a restored draft: the payer is still me', async ({page}) => {
      await openAddExpense(page, size)
      const add = composeButton(page)
      await page.getByTestId('expense-title').fill('Half-typed groceries')
      await page.getByTestId('sheet-close').click()
      await page.getByTestId('draft-save').click()
      await expect(page.getByTestId('screen-add-expense')).toHaveCount(0)
      await add.click()
      await expect(page.getByTestId('expense-title')).toHaveValue('Half-typed groceries')
      await expectPaidByMe(page)
    })
  })
}

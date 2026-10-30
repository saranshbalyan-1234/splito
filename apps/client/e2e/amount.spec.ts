import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/* F-310 smart amount input, F-402 cash rounding, F-1801 money direction. */

const DESKTOP = {width: 1440, height: 900}
const PHONE = {width: 390, height: 844}

async function openAddExpense(page: Page) {
  await page.setViewportSize(DESKTOP)
  await openDemo(page, '/people')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
}

test('shorthand, pasted amounts and native digits read as amounts', async ({
  page,
}) => {
  await openAddExpense(page)
  const amount = page.getByTestId('amount-input')
  await amount.fill('1.5L')
  await expect(page.getByTestId('amount-result')).toHaveText(/= ₹1,?50,000\.00/)
  await amount.fill('2k + 500')
  await expect(page.getByTestId('amount-result')).toHaveText('= ₹2,500.00')
  // A paste keeps the number and drops the currency sign.
  await amount.fill('₹1,234.50')
  await expect(amount).toHaveValue('1,234.50')
  await expect(page.getByTestId('amount-result')).toHaveText('= ₹1,234.50')
  await amount.fill('१२००')
  await expect(page.getByTestId('amount-result')).toHaveText('= ₹1,200.00')
})

test('an ambiguous amount asks which it is, and Save waits for the answer', async ({
  page,
}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-title').fill('Hotel deposit')
  await page.getByTestId('amount-input').fill('1.234')
  await expect(page.getByTestId('amount-readings')).toBeVisible()
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('amount-reading-grouped').click()
  await expect(page.getByTestId('amount-readings')).toHaveCount(0)
  await expect(page.getByTestId('amount-result')).toHaveText('= ₹1,234.00')
  await expect(page.getByTestId('sheet-save')).toBeEnabled()
  // Changing the text asks again.
  await page.getByTestId('amount-input').fill('2.345')
  await expect(page.getByTestId('amount-readings')).toBeVisible()
})

test('cash rounding: whole shares, the remainder shown on one person, saved with the expense', async ({
  page,
}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-title').fill('Cab to the station')
  await page.getByTestId('amount-input').fill('1000.50')
  await page.getByTestId('expense-people').click()
  for (const name of ['Riya Sharma', 'Sam Carter'])
    await page.getByTestId(`person-option-${name}`).click()
  await page.getByTestId('people-dialog').getByTestId('sheet-close').click()
  await expect(page.getByTestId('cash-rounding')).toBeVisible()

  await page.getByTestId('cash-rounding-switch').click()
  await expect(page.getByTestId('cash-unit-1')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('cash-remainder')).toContainText('₹0.50')
  await expect(page.getByTestId('cash-remainder')).toContainText('₹1,000.50')
  // Ids are minted per run, so who gets the extra unit varies; every share is whole.
  await expect(page.getByTestId('share-You')).toHaveText(/^₹33[34]\.(00|50)/)

  await page.getByTestId('cash-unit-10').click()
  await expect(page.getByTestId('share-You')).toHaveText(/^₹3[34]0\.(00|50)/)
  await expect(page.getByTestId('cash-remainder')).toContainText('₹0.50')

  await page.getByTestId('sheet-save').click()
  await expect(page.getByText(/Expense added|Changes saved/)).toBeVisible()
  await page.getByRole('button', {name: 'View expense'}).click()
  await expect(page.getByTestId('expense-cash-rounding')).toContainText(
    'Rounded to ₹10 for cash',
  )
  await expect(page.getByTestId('expense-cash-rounding')).toContainText(
    '₹0.50 left over',
  )
})

test('phones: the keypad replaces the keyboard and works as a calculator', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/people')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('fab-add').click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
  await page.getByTestId('amount-input').click()
  await expect(page.getByTestId('amount-keypad')).toBeVisible()
  await expect(page.getByTestId('amount-input')).toHaveAttribute(
    'inputmode',
    'none',
  )
  for (const key of ['1', '2', '0', '0', '+', '3', '000', 'mark', '5'])
    await page.getByTestId(`key-${key}`).click()
  await expect(page.getByTestId('amount-input')).toHaveValue('1200 + 3000.5')
  await expect(page.getByTestId('amount-result')).toHaveText('= ₹4,200.50')
  // A third decimal is refused, as Expensify's pad does.
  await page.getByTestId('key-5').click()
  await page.getByTestId('key-5').click()
  await expect(page.getByTestId('amount-input')).toHaveValue('1200 + 3000.55')
  await page.getByTestId('key-delete').click()
  await page.getByTestId('calc-equals').click()
  await expect(page.getByTestId('amount-input')).toHaveValue('4200.50')
})

test('money direction is never colour alone: arrows and words on balances', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page, '/people')
  const row = page.getByTestId('person-Riya Sharma')
  await expect(row).toBeVisible()
  await expect(row).toContainText(/(owes you|you owe) [↙↗]/)
  await row.click()
  await expect(page.getByTestId('screen-person')).toBeVisible()
  await expect(page.getByTestId(/^person-direction-/).first()).toHaveText(
    /Owes you|You owe/,
  )
})

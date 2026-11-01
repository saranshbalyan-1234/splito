import {expect, test} from '@playwright/test'

import {openAddExpense, openMoreOptions, pickPeople} from './composer'
import {openDemo} from './openDemo'
import {DESKTOP, PHONE} from './viewports'

/* F-310 smart amount input, F-402 cash rounding, F-1801 money direction. */

test('shorthand, pasted amounts and native digits read as amounts', async ({
  page,
}) => {
  await openAddExpense(page, DESKTOP)
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
  await openAddExpense(page, DESKTOP)
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
  await openAddExpense(page, DESKTOP)
  await page.getByTestId('expense-title').fill('Cab to the station')
  await page.getByTestId('amount-input').fill('1000.50')
  await pickPeople(page, ['Riya Sharma', 'Sam Carter'])
  await openMoreOptions(page)
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

test('phones: the amount opens the number keyboard, and the + − × ÷ bar still adds (owner 231)', async ({
  page,
}) => {
  await openAddExpense(page, PHONE)
  const input = page.getByTestId('amount-input')
  await input.click()
  /* No keypad of Splito's own: the system keyboard, in its decimal (number) mode. */
  await expect(page.getByTestId('amount-keypad')).toHaveCount(0)
  await expect(input).toHaveAttribute('inputmode', 'decimal')
  /* A person's pace: keys 5 ms apart (Playwright's default) outrun the composer's render (ARCHITECTURE 17.1). */
  await input.pressSequentially('1200', {delay: 40})
  await page.getByTestId('calc-+').click()
  await input.pressSequentially('3000.5', {delay: 40})
  await expect(input).toHaveValue('1200 + 3000.5')
  await expect(page.getByTestId('amount-result')).toHaveText('= ₹4,200.50')
  await page.getByTestId('calc-equals').click()
  await expect(input).toHaveValue('4200.50')
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

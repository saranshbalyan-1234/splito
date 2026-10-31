import {expect, type Page, test} from '@playwright/test'

import {type SplitoDevTools} from '../src/data/devTools'
import {openApp} from './app'
import {BASE, seedA04} from './seed'

/** Kavya owes me 100 directly and 50 in a shared group, plus EUR 5 directly (and a deleted pizza). */
async function seed(page: Page) {
  const {kavya, group} = await seedA04(page)
  const pizza = await page.evaluate(
    async ({kavya, base}) => {
      const s = (window as unknown as {splito: SplitoDevTools}).splito
      const draft = (title: string, total: string, date: string, over: object = {}) => ({
        ...base,
        title,
        groupId: null,
        total,
        payers: {[s.me]: total},
        split: {mode: 'equal', participants: [s.me, kavya]},
        date,
        ...over,
      })
      await s.createExpense(draft('Coffee', '1000', '2026-10-22', {currency: 'EUR'}))
      const pizza = await s.createExpense(draft('Pizza', '60000', '2026-10-23'))
      await s.deleteExpense(pizza)
      return pizza
    },
    {kavya, base: BASE},
  )
  return {kavya, group, pizza}
}

async function openCallItEven(page: Page) {
  await page.getByTestId('person-more').click()
  await page.getByTestId('person-call-even').click()
  await expect(page.getByTestId('call-even-sheet')).toBeVisible()
}

test('Call it even clears the INR balance (direct and group), keeps EUR, shows in history, and undoes', async ({
  page,
}) => {
  await openApp(page)
  const {kavya} = await seed(page)
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')

  await openCallItEven(page)
  await expect(page.getByTestId('call-even-sentence')).toHaveText(
    'You let Kavya Rao off',
  )
  await expect(page.getByTestId('call-even-amount')).toHaveValue('150.00')
  await expect(page.getByTestId('call-even-clears')).toContainText(
    'Direct ₹100.00',
  )
  await expect(page.getByTestId('call-even-clears')).toContainText(
    'Pune trip ₹50.00',
  )
  await page.getByTestId('call-even-note').fill('Birthday treat')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByText(/^(All even|Written off)$/)).toBeVisible()
  await expect(page.getByTestId('call-even-sheet')).toHaveCount(0)

  // INR is even; EUR is untouched; the write-off is in history, never as a payment.
  await expect(page.getByTestId('person-total-INR')).toHaveCount(0)
  await expect(page.getByTestId('person-total-EUR')).toHaveText('€5.00')
  const row = page.locator('[data-testid^="history-"]', {
    hasText: 'You forgave Kavya Rao',
  })
  await expect(row.first()).toContainText('Called it even · Birthday treat')

  // One write-off record per part; the toast's Undo removes every part at once.
  await expect(row).toHaveCount(2)
  await page.getByRole('button', {name: 'Undo'}).click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  // The undone write-offs stay in the history, struck through (they no longer count).
  await expect(row).toHaveCount(2)
  await expect(row.first().getByText('You forgave Kavya Rao')).toHaveCSS('text-decoration-line', 'line-through')
})

test('a part write-off leaves the rest open; more than the balance is refused', async ({
  page,
}) => {
  await openApp(page)
  const {kavya} = await seed(page)
  await page.goto(`/people/${kavya}`)
  await openCallItEven(page)
  await page.getByTestId('call-even-amount').fill('200')
  await expect(page.getByTestId('call-even-hint')).toHaveText(
    'That’s more than the open balance of ₹150.00.',
  )
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('call-even-amount').fill('40')
  await expect(page.getByTestId('call-even-hint')).toHaveText(
    'Part of it: ₹110.00 stays open.',
  )
  await expect(page.getByTestId('sheet-save')).toHaveText('Write off')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹110.00')

  // Undo from the write-off's own details puts its part back.
  await page
    .locator('[data-testid^="history-"]', {hasText: 'You forgave Kavya Rao'})
    .click()
  await expect(page.getByTestId('payment-details-sheet')).toContainText(
    'Called it even',
  )
  await page.getByTestId('writeoff-undo').click()
  await expect(page.getByText('Write-off undone')).toBeVisible()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
})

test('group balances: Call it even on a "who owes whom" row clears that pair in the group', async ({
  page,
}) => {
  await openApp(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}?tab=balances`)
  await page.getByTestId('group-owe-Kavya Rao-You-more').click()
  await page.getByTestId('owe-call-even').click()
  await expect(page.getByTestId('call-even-amount')).toHaveValue('50.00')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('group-owes-title')).toHaveCount(0)
  // Shows in Activity.
  await page.goto('/activity')
  await expect(
    page.getByText('You called it even with Kavya Rao'),
  ).toBeVisible()
})

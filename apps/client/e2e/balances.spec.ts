import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/* F-113: balances and settle consistency (audit M6, M10, m5, m7), seeded through window.splito. */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
}

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
}

/** Bob owes me ₹10 directly; I owe Bob ₹10 in Goa. The net is zero, both parts are open. */
async function seedBothWays(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const bob = await s.createPerson('Bob Mehta')
    const group = await s.createGroup({
      name: 'Goa',
      kind: 'trip',
      currency: 'INR',
      startDate: null,
      endDate: null,
      memberIds: [bob],
    })
    const base = {
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      total: '2000',
      split: {mode: 'equal', participants: [s.me, bob]},
      date: '2026-10-20',
    }
    await s.createExpense({
      ...base,
      title: 'Chai',
      groupId: null,
      payers: {[s.me]: '2000'},
    })
    await s.createExpense({
      ...base,
      title: 'Taxi',
      groupId: group,
      payers: {[bob]: '2000'},
    })
    return {bob}
  })
}

test('M10 + m7 + m5: direct and group debts that net to zero stay open, and Call it even clears both', async ({
  page,
}) => {
  await ready(page)
  const {bob} = await seedBothWays(page)

  // People: both ways on the row, never "Settled".
  const row = page.getByTestId('person-Bob Mehta')
  await expect(row.getByTestId('balance-INR-owed')).toContainText('₹10.00')
  await expect(row.getByTestId('balance-INR-owe')).toContainText('₹10.00')
  await expect(row.getByTestId('person-row-settled')).toHaveCount(0)

  // Person page: open both ways, and Call it even is offered.
  await page.goto(`/people/${bob}`)
  await expect(page.getByTestId('person-direction-INR')).toHaveText(
    'Even overall, open both ways',
  )
  await page.getByTestId('person-more').click()
  await page.getByTestId('person-call-even').click()
  await expect(page.getByTestId('call-even-sheet')).toBeVisible()
  await expect(page.getByTestId('call-even-sentence')).toHaveText(
    'You and Bob Mehta let each other off',
  )
  await expect(page.getByTestId('call-even-amount')).toHaveCount(0)
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('call-even-done')).toBeVisible()
  await expect(page.getByTestId('person-settled')).toBeVisible()

  // Activity: told from who did it (me), with Bob.
  await page.goto('/activity')
  await expect(
    page.getByTestId('activity-writeoff.recorded').first(),
  ).toContainText('You called it even with Bob Mehta')
})

test('M6: the payer cannot be unticked from "Split with"', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await openDemo(page, '/people')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await page.getByTestId('amount-input').fill('900')
  await page.getByTestId('expense-people').click()
  await page.getByTestId('person-option-Riya Sharma').click()
  await expect(page.getByTestId('person-option-locked-You')).toHaveText(
    'Paid · change who paid to remove',
  )
  await page.getByTestId('person-option-You').click({force: true})
  await page.getByTestId('people-dialog').getByTestId('sheet-close').click()
  await expect(page.getByTestId('people-dialog')).toHaveCount(0)
  await expect(page.getByTestId('split-readout')).toContainText('2 people')
})

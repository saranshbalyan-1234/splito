import {expect, type Page, test} from '@playwright/test'

/*
 * F-112, many-currency completeness (audit M5, M8, M12, M15, m2, m3, m21): each test
 * fails on the code before the fix. Seeded through window.splito; amounts are minor units.
 */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
  createRepayment(input: unknown): Promise<string>
  setPref(key: string, value: unknown): Promise<void>
  list(
    type: string,
  ): Promise<Array<{id: string; data: Record<string, unknown>}>>
}
const DESKTOP = {width: 1440, height: 900}

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
}

/** Bob owes me EUR 10 (then pays it back) and INR 50; the EUR is settled, the INR is open. */
async function seedSettledEuro(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const bob = await s.createPerson('Bob Mehta')
    const group = await s.createGroup({
      name: 'Lisbon',
      kind: 'trip',
      currency: 'EUR',
      startDate: null,
      endDate: null,
      memberIds: [bob],
    })
    const base = {
      tz: 'Europe/Lisbon',
      category: 'food',
      notes: '',
      date: '2026-10-20',
    }
    const split = {mode: 'equal', participants: [s.me, bob]}
    const add = (
      title: string,
      groupId: string | null,
      currency: string,
      total: string,
    ) =>
      s.createExpense({
        ...base,
        title,
        groupId,
        currency,
        total,
        payers: {[s.me]: total},
        split,
      })
    await add('Dinner', null, 'EUR', '2000')
    await add('Taxi', null, 'INR', '10000')
    await add('Museum', group, 'EUR', '2000')
    await add('Hotel', group, 'INR', '10000')
    for (const [groupId, amount] of [
      [null, '1000'],
      [group, '1000'],
    ] as const)
      await s.createRepayment({
        groupId,
        currency: 'EUR',
        from: bob,
        to: s.me,
        amount,
        date: '2026-10-21',
        tz: 'Europe/Lisbon',
        note: '',
      })
    return bob
  })
}

test('m3: a currency settled with a friend stays on offer and filters under Settled', async ({
  page,
}) => {
  await ready(page)
  await seedSettledEuro(page)
  await page.goto('/')
  await expect(page.getByTestId('person-Bob Mehta')).toBeVisible()
  await page.getByTestId('screen-people').getByTestId('list-filters').click()
  await page.getByTestId('filter-currency-EUR').click()
  await page.getByTestId('filter-show-settled').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-Bob Mehta')).toBeVisible()
  // Open in rupees, but the filter asked for euros and euros are square.
  await expect(page.getByTestId('person-Bob Mehta')).toContainText('Settled up')
})

test('m3: a currency settled in a group stays filterable on Groups', async ({
  page,
}) => {
  await ready(page)
  await seedSettledEuro(page)
  await page.goto('/groups')
  await expect(page.getByTestId('group-Lisbon')).toBeVisible()
  const groups = page.getByTestId('screen-groups')
  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-currency-EUR').click()
  await page.getByTestId('filter-show-settled').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()
})

test('M5: picking a group after typing an amount keeps the currency; a picked currency stays', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await expect(page.getByTestId('amount-currency')).toContainText('INR')
  await page.getByTestId('amount-input').fill('45')
  await page.getByTestId('expense-group').click()
  await page.getByTestId('group-option-Lisbon').click()
  await expect(page.getByTestId('expense-group-value')).toHaveText('Lisbon')
  // Lisbon's home currency is EUR, but 45 was typed in rupees: still rupees.
  await expect(page.getByTestId('amount-currency')).toContainText('INR')
  await expect(page.getByTestId('amount-input')).toHaveValue('45')
})

test('M5: an empty new expense still takes the group home currency, until one is picked', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await page.getByTestId('expense-group').click()
  await page.getByTestId('group-option-Lisbon').click()
  await expect(page.getByTestId('amount-currency')).toContainText('EUR')
  await page.getByTestId('amount-currency').click()
  await page.getByTestId('currency-USD').click()
  await expect(page.getByTestId('amount-currency')).toContainText('USD')
  await page.getByTestId('expense-group').click()
  await page.getByTestId('group-option-Goa trip').click()
  await expect(page.getByTestId('amount-currency')).toContainText('USD')
})

test('M8: Record payment on a settled friend offers every currency, starting on the default', async ({
  page,
}) => {
  await ready(page)
  const bob = await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    await s.setPref('defaultCurrency', 'EUR')
    return s.createPerson('Sam Settled')
  })
  await page.goto(`/people/${bob}`)
  await page.getByTestId('person-record-payment').click()
  // Settled and the default is EUR: the dialog starts in EUR, not rupees.
  await expect(page.getByTestId('payment-sentence')).toBeVisible()
  await expect(page.getByTestId('record-payment-sheet')).toContainText('EUR')
  await page.getByTestId('payment-other-currency').click()
  await page.getByTestId('currency-JPY').click()
  await page.getByTestId('payment-amount').fill('500')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('payment-recorded')).toBeVisible()
  await expect(page.getByTestId('person-total-JPY')).toHaveText('¥500')
})

test('M12, m2: Recently active groups shows a chip per open currency, with exact amounts', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  const recent = page
    .getByTestId('right-nav')
    .getByTestId('sidebar-recent-groups')
  // Lisbon holds euros and rupees side by side (the demo's flights were booked in India).
  const euros = recent.getByTestId('sidebar-group-balance-Lisbon-EUR')
  const rupees = recent.getByTestId('sidebar-group-balance-Lisbon-INR')
  await expect(euros).toHaveText(/^−€[\d,]+\.\d\d$/)
  await expect(rupees).toHaveText(/^\+₹[\d,]+\.\d\d$/)
  await expect(recent.getByTestId('sidebar-group-Lisbon')).toHaveAttribute(
    'aria-label',
    /you owe €.*you are owed ₹/,
  )
})

test('m21: an Overview currency card opens Analytics in that currency', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('summary-EUR').click()
  await expect(page).toHaveURL(/\/analytics\?currency=EUR/)
  await expect(page.getByTestId('analytics-currency')).toContainText('EUR')
})

test('M15: the cash unit is chosen per currency in Settings and a unit too big for the bill splits it exactly', async ({
  page,
}) => {
  await ready(page)
  await page.goto('/settings/defaults')
  await page.getByTestId('split.roundCash-switch').click()
  await expect(page.getByTestId('round-to-currency')).toContainText('INR')
  await page.getByTestId('round-to-10').click()
  await page.getByTestId('round-to-currency').click()
  await page.getByTestId('round-to-currency-dialog-JPY').click()
  await page.getByTestId('round-to-100').click()
  const unit = await page.evaluate(async () => {
    const rows = await (window as unknown as {splito: Splito}).splito.list(
      'preference',
    )
    return rows.find(r => r.id === 'split.roundTo')?.data.value
  })
  expect(unit).toEqual({INR: 10, JPY: 100})
})

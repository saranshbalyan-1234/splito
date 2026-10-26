import {expect, type Page, test} from '@playwright/test'

/* Seeds through the app's own mutations (window.splito, dev/E2E builds only). Amounts are minor units. */
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

/** A07 group: me (A), Bela (B), Chirag (C). Chirag paid 100 for me, so I owe Chirag 100. */
async function seedA07(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const b = await s.createPerson('Bela Joshi')
    const c = await s.createPerson('Chirag Shah')
    const group = await s.createGroup({name: 'Rishikesh', kind: 'trip', currency: 'INR', startDate: '2026-09-04', endDate: '2026-09-07', memberIds: [b, c]})
    await s.createExpense({title: 'Rafting', groupId: group, currency: 'INR', total: '10000', payers: {[c]: '10000'}, split: {mode: 'equal', participants: [s.me]}, date: '2026-09-05', tz: 'Asia/Kolkata', category: 'entertainment', notes: ''})
    return {group, me: s.me, b, c}
  })
}

test('phones: the pushed group page has no FAB; its own Add expense pre-selects the group', async ({page}) => {
  await ready(page)
  const {group} = await seedA07(page)
  await page.setViewportSize({width: 390, height: 844})
  await page.goto(`/groups/${group}`)
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await expect(page.getByTestId('screen-group').getByTestId('fab-add')).toHaveCount(0)
  await page.getByTestId('group-add-expense').click()
  await expect(page).toHaveURL(new RegExp(`/expense/new\\?groupId=${group}`))
})

test('group page: header, my balance, expenses, member balances and members', async ({page}) => {
  await ready(page)
  const {group} = await seedA07(page)
  await page.goto(`/groups/${group}`)

  await expect(page.getByTestId('group-name')).toHaveText('Rishikesh')
  await expect(page.getByTestId('group-byline')).toHaveText('Trip · 3 members')
  await expect(page.getByTestId('group-dates')).toHaveText('Sep 4 – Sep 7, 2026')
  // My balance is a card: direction, currency, then the amount.
  await expect(page.getByTestId('group-my-balance-INR')).toHaveText(/^You owe\s*₹100\.00$/)
  await expect(page.getByText('Rafting')).toBeVisible()
  // History rows stack what it means over the amount.
  const rafting = page.locator('[data-testid^="history-"]', {hasText: 'Rafting'})
  await expect(rafting).toContainText('you borrowed')
  await expect(rafting).toContainText('₹100.00')

  await page.getByTestId('group-tab-balances').click()
  await expect(page.getByTestId('group-net-INR-Chirag Shah-text')).toHaveText('gets back ↙ ₹100.00')
  await expect(page.getByTestId('group-net-INR-You-text')).toHaveText('you owe ↗ ₹100.00')
  await expect(page.getByTestId('group-net-INR-Bela Joshi-text')).toHaveText('settled up')
  // Who owes whom: the direct plan, with Settle up beside it.
  await expect(page.getByTestId('group-owe-You-Chirag Shah')).toContainText('You owe Chirag Shah')
  await expect(page.getByTestId('group-owe-You-Chirag Shah')).toContainText('₹100.00')
  await expect(page.getByTestId('group-balances-settle')).toBeVisible()

  await page.getByTestId('group-tab-members').click()
  await expect(page.getByTestId('member-You')).toBeVisible()
  await page.getByTestId('group-add-members').click()
  await page.getByTestId('add-member-new').fill('Dev Malik')
  await page.getByTestId('add-member-new-save').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('member-Dev Malik')).toBeVisible()
  await expect(page.getByTestId('group-byline')).toHaveText('Trip · 4 members')
  await page.getByTestId('member-Bela Joshi').click()
  await expect(page.getByTestId('person-name')).toHaveText('Bela Joshi')
})

test('A07: A->C excluded makes the direct plan infeasible and says why (routing via others waits for v2)', async ({page}) => {
  await ready(page)
  const {group, me, c} = await seedA07(page)

  // Rule set in the Payment rules sheet ("Who you settle with"), as a user would.
  await page.goto(`/groups/${group}`)
  await page.getByTestId('group-more').click()
  await page.getByTestId('group-menu-rules').click()
  const sheet = page.getByTestId('rules-sheet')
  await expect(sheet.getByText('Who you settle with')).toBeVisible()
  await expect(sheet.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId(`rule-${me}-${c}-excluded`).click()
  await expect(page.getByText('Set for this group')).toHaveCount(1)
  await sheet.getByTestId('sheet-save').click()
  await expect(sheet).toHaveCount(0)

  await page.goto(`/groups/${group}/settle`)
  await expect(page.getByText('No direct plan works with these rules')).toBeVisible()
  await expect(page.getByTestId('settle-stuck-INR')).toHaveText('No allowed pair to pay anyone who is owed: You')

  // Spec v1 is direct-only: no plan routes money through members who never agreed to it.
  await expect(page.getByTestId('settle-mode-transit')).toHaveCount(0)
  await expect(page.getByTestId('settle-try-transit')).toHaveCount(0)
  // "Edit rules" goes back to the group with its Payment rules sheet open.
  await page.getByTestId('settle-edit-rules').click()
  await expect(page.getByTestId('rules-sheet').getByText('Who you settle with', {exact: true})).toBeVisible()
  await expect(page.getByTestId('screen-group')).toBeVisible()
})

test('a plan goes stale when the ledger changes, and updates on request', async ({page}) => {
  await ready(page)
  const {group, b} = await seedA07(page)
  await page.goto(`/groups/${group}/settle`)
  await expect(page.getByTestId('transfer-You-Chirag Shah').getByTestId('transfer-amount')).toHaveText('↗ ₹100.00')
  // The plan's version is a data attribute for tests; users never see a hash.
  const before = await page.getByTestId('settle-footer').getAttribute('data-plan-hash')
  expect(before).toBeTruthy()
  await expect(page.getByText(/Plan [0-9a-f]{8}/)).toHaveCount(0)

  await page.evaluate(
    async ({group, b}) => {
      const s = (window as any).splito
      await s.createExpense({title: 'Chai', groupId: group, currency: 'INR', total: '4000', payers: {[b]: '4000'}, split: {mode: 'equal', participants: [s.me]}, date: '2026-09-06', tz: 'Asia/Kolkata', category: 'food', notes: ''})
    },
    {group, b},
  )
  await expect(page.getByText('Balances or rules changed since this plan was made.')).toBeVisible()
  // The shown plan stays as it was until the user updates it.
  await expect(page.getByTestId('settle-count-INR')).toHaveText('1 payment')
  await page.getByTestId('settle-refresh').click()
  await expect(page.getByText('Balances or rules changed since this plan was made.')).toHaveCount(0)
  await expect(page.getByTestId('settle-count-INR')).toHaveText('2 payments')
  await expect(page.getByTestId('transfer-You-Bela Joshi').getByTestId('transfer-amount')).toHaveText('↗ ₹40.00')
  expect(await page.getByTestId('settle-footer').getAttribute('data-plan-hash')).not.toBe(before)
})

test('"Record this payment" records a part payment and the plan follows', async ({page}) => {
  await ready(page)
  const {group} = await seedA07(page)
  await page.goto(`/groups/${group}/settle`)
  const transfer = page.getByTestId('transfer-You-Chirag Shah')
  await expect(transfer.getByTestId('transfer-sentence')).toHaveText('You pay Chirag Shah')
  // The plan opens with what it means for me, not with how it is made.
  await expect(page.getByTestId('settle-summary')).toContainText('You’ll pay, to 1 person')
  await expect(page.getByTestId('settle-explanation')).toHaveCount(0)
  await page.getByTestId('settle-how').click()
  await expect(page.getByTestId('settle-explanation')).toBeVisible()
  await transfer.getByTestId('transfer-record').click()
  await expect(page.getByTestId('payment-sentence')).toHaveText('You paid Chirag Shah')
  await expect(page.getByTestId('payment-amount')).toHaveValue('100.00')
  await page.getByTestId('payment-amount').fill('60')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('payment-recorded')).toBeVisible()

  await expect(transfer.getByTestId('transfer-amount')).toHaveText('↗ ₹40.00')
  await expect(page.getByText('Balances or rules changed since this plan was made.')).toHaveCount(0)
  await expect(page.getByText('send money', {exact: false})).toHaveCount(0)

  await page.goto(`/groups/${group}`)
  await expect(page.getByTestId('group-my-balance-INR')).toHaveText(/^You owe\s*₹40\.00$/)
  await expect(page.getByText('You paid Chirag Shah')).toBeVisible()
})

test('create a group with a new member, then land on it', async ({page}) => {
  await ready(page)
  await page.evaluate(() => (window as any).splito.createPerson('Isha Kapoor'))
  await page.goto('/groups/new')
  await page.getByTestId('create-group-name').fill('Weekend in Goa')
  await page.getByTestId('create-group-member-Isha Kapoor').click()
  await page.getByTestId('create-group-new-member').fill('Rohan Gill')
  await page.getByTestId('create-group-add-member').click()
  await page.getByTestId('create-group-currency').click()
  await page.getByTestId('currency-EUR').click()
  await expect(page.getByTestId('create-group-currency')).toContainText('EUR · Euro')
  await page.getByTestId('sheet-save').click()

  await expect(page.getByTestId('group-name')).toHaveText('Weekend in Goa')
  await expect(page.getByTestId('group-byline')).toHaveText('Trip · 3 members')
  await expect(page.getByTestId('group-expenses-empty')).toBeVisible()
  await expect(page.getByTestId('group-settle')).toBeDisabled()
})

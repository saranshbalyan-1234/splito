import {expect, test} from '@playwright/test'
import {balanceRows, balanceSides, personSummary} from '@splito/domain'
import {DEMO_LARGE_PREFIX, generateLargeDemo, localToday, planLedger} from '@splito/sync/demoLarge'

import {type SplitoDevTools} from '../src/data/devTools'
import {openApp} from './app'
import {openDemo, setPref} from './openDemo'
import {seedA04} from './seed'
import {LAPTOP, PHONE} from './viewports'

/** A currency and direction nobody matches in the demo dataset (computed from its plan, so it follows the data). */
function emptyFilter(): [currency: string, show: 'owesYou' | 'youOwe'] {
  const me = `${DEMO_LARGE_PREFIX}me`
  const plan = generateLargeDemo({me, today: localToday(), now: Date.now()})
  const people = personSummary(balanceRows(planLedger(plan), me), {includeGroups: true}).filter(p => p.person !== me)
  for (const currency of ['BHD', 'KWD', 'JPY', 'THB', 'GBP'])
    for (const show of ['owesYou', 'youOwe'] as const) {
      const hit = people.some(p => {
        const c = p.byCurrency[currency]
        return c !== undefined && (show === 'owesYou' ? balanceSides(c).owed > 0n : balanceSides(c).owe > 0n)
      })
      if (!hit) return [currency, show]
    }
  throw new Error('every currency has a friend in both directions: pick another filter')
}

test('A04: direct 100 + group 50 = 150; Include groups off = 100, totals and history', async ({
  page,
}) => {
  await openApp(page)
  const {kavya} = await seedA04(page)
  await page.goto(`/people/${kavya}`)

  await expect(page.getByTestId('person-name')).toHaveText('Kavya Rao')
  await expect(page.getByTestId('person-direction-INR')).toHaveText('Owes you')
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await expect(page.getByTestId('person-part-INR-direct')).toContainText(
    '+₹100.00',
  )
  await expect(page.getByTestId('person-history-title')).toHaveText(
    'History  2',
  )
  await expect(page.getByText('Snacks')).toBeVisible()

  await page.getByTestId('person-filter').click()
  await page.getByTestId('filter-include-groups').click()
  // Nothing changes before Apply.
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await page.getByTestId('sheet-save').click()

  await expect(page.getByTestId('person-total-INR')).toHaveText('₹100.00')
  await expect(page.getByTestId('person-history-title')).toHaveText(
    'History  1',
  )
  await expect(page.getByText('Direct only')).toBeVisible()
  await expect(page.getByText('Snacks')).toHaveCount(0)
  await expect(page.getByText('Concert')).toBeVisible()
  const concert = page.locator('[data-testid^="history-"]', {
    hasText: 'Concert',
  })
  // An expense row says what it did (Splitwise's words); balances say "owes you".
  await expect(concert).toContainText('you lent')
  await expect(concert).toContainText('₹100.00')
})

test('the Include groups default comes from preferences', async ({page}) => {
  await openApp(page)
  const {kavya} = await seedA04(page)
  await setPref(page, 'includeGroupsDefault', false)
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹100.00')
  await expect(
    page.getByTestId('screen-person').getByText('Direct only'),
  ).toBeVisible()
})

test('recording a part payment moves the balance; deleting it is undoable', async ({
  page,
}) => {
  await openApp(page)
  const {kavya} = await seedA04(page)
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')

  await page.getByTestId('person-record-payment').click()
  await expect(page.getByTestId('payment-sentence')).toHaveText(
    'Kavya Rao paid you',
  )
  await expect(page.getByTestId('payment-amount')).toHaveValue('150.00')
  await page.getByTestId('payment-amount').fill('40')
  await page.getByTestId('payment-note').fill('Cash')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByText('Payment recorded', {exact: true})).toBeVisible()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹110.00')

  const row = page.getByRole('button', {name: 'Kavya Rao paid you'})
  await expect(row).toContainText('₹40.00')
  await expect(row).toContainText('Payment · Cash')
  await row.click()
  await expect(page.getByTestId('payment-details-amount')).toHaveText('₹40.00')
  await page.getByTestId('payment-delete').click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await page.getByRole('button', {name: 'Undo'}).click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹110.00')
})

test('swapping the direction records what I paid them', async ({page}) => {
  await openApp(page)
  const {kavya} = await seedA04(page)
  await page.goto(`/people/${kavya}`)
  await page.getByTestId('person-record-payment').click()
  await page.getByTestId('payment-swap').click()
  await expect(page.getByTestId('payment-sentence')).toHaveText(
    'You paid Kavya Rao',
  )
  await page.getByTestId('payment-amount').fill('25')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹175.00')
})

test('paying the whole balance from a friend’s page settles the group part too, so nobody pays twice', async ({
  page,
}) => {
  await openApp(page)
  const {kavya} = await seedA04(page)
  await page.goto(`/people/${kavya}`)
  await page.getByTestId('person-record-payment').click()
  await expect(page.getByTestId('payment-amount')).toHaveValue('150.00')
  await expect(page.getByTestId('payment-settles')).toHaveText(
    'Counts towards: Direct ₹100.00 · Pune trip ₹50.00',
  )
  await page.getByTestId('sheet-save').click()
  await expect(page.getByText('Payment recorded', {exact: true})).toBeVisible()
  await expect(page.getByTestId('person-settled')).toBeVisible()

  // The group agrees: nothing left to settle there (a settled group is hidden by default, so show it).
  // Settled groups and friends are hidden by default (F-1413); this spec reads them, so show them.
  await setPref(page, 'groups.showSettled', true)
  await page.goto('/groups')
  await page.getByTestId('screen-groups').getByText('Pune trip').click()
  await expect(page.getByTestId('group-settle')).toBeDisabled()
})

test('People: the Include groups filter changes the totals only on Apply', async ({
  page,
}) => {
  await openApp(page)
  await seedA04(page)
  await page.goto('/people')
  const row = page.getByTestId('person-Kavya Rao')
  await expect(row.getByTestId('balance-INR')).toHaveText('owes you ↙ ₹150.00')
  await expect(page.getByTestId('list-filters-dot')).toHaveCount(0)
  await page.getByTestId('list-filters').click()
  await page.getByTestId('filter-include-groups').click()
  await expect(row.getByTestId('balance-INR')).toHaveText('owes you ↙ ₹150.00')
  await page.getByTestId('sheet-save').click()
  await expect(row.getByTestId('balance-INR')).toHaveText('owes you ↙ ₹100.00')
  // The button carries a dot and says how many filters differ from the defaults.
  await expect(page.getByTestId('list-filters-dot')).toBeVisible()
  await expect(page.getByTestId('list-filters')).toHaveAttribute(
    'aria-label',
    'Filters, 1 on',
  )
})

test('People filters: one currency, which way, and the order drive the list and the summary', async ({
  page,
}) => {
  await openDemo(page, '/people')
  const people = page.getByTestId('screen-people')
  await expect(people.getByTestId('person-Arjun Mehta')).toBeVisible()

  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-currency-EUR').click()
  await page.getByTestId('filter-show-youOwe').click()
  // Nothing changes before Apply.
  await expect(people.getByTestId('person-Arjun Mehta')).toBeVisible()
  await page.getByTestId('sheet-save').click()

  // Only friends I owe in euros, and only euros in the summary.
  await expect(people.getByTestId('person-Arjun Mehta')).toHaveCount(0)
  await expect(people.getByTestId('person-Sam Carter')).toBeVisible()
  await expect(
    people.getByTestId('person-Sam Carter').getByTestId('balance-INR'),
  ).toHaveCount(0)
  await expect(people.getByTestId('list-filters')).toHaveAttribute(
    'aria-label',
    'Filters, 2 on',
  )

  // Cancel leaves the applied filters alone; nobody matching shows a way back.
  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-show-owesYou').click()
  // A changed sheet asks before it drops the change.
  await page.getByTestId('sheet-cancel').click()
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await page.getByTestId('confirmBtn').click()
  await expect(people.getByTestId('person-Sam Carter')).toBeVisible()
  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-show-owesYou').click()
  await page.getByTestId('sheet-save').click()
  // Owed to me in euros: Sam, whom I owe, is gone (F-112 m3: friends square in euros stay filterable through Show settled).
  await expect(people.getByTestId('person-Sam Carter')).toHaveCount(0)
  // A currency and direction nobody matches shows the way back.
  const [emptyCurrency, emptyShow] = emptyFilter()
  await people.getByTestId('list-filters').click()
  await page.getByTestId(`filter-currency-${emptyCurrency}`).click()
  await page.getByTestId(`filter-show-${emptyShow}`).click()
  await page.getByTestId('sheet-save').click()
  await expect(people.getByTestId('people-filtered-empty')).toBeVisible()
  await people.getByTestId('people-clear-filters').click()
  await expect(people.getByTestId('person-Arjun Mehta')).toBeVisible()
})

test('People sorts by the biggest balance, recent activity or name (preference)', async ({
  page,
}) => {
  await openApp(page)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: SplitoDevTools}).splito
    const base = {
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      groupId: null,
    }
    const small = await s.createPerson('Aarav Small')
    const big = await s.createPerson('Zoya Big')
    await s.createExpense({
      ...base,
      title: 'Rent',
      total: '200000',
      payers: {[s.me]: '200000'},
      split: {mode: 'equal', participants: [s.me, big]},
      date: '2026-09-01',
    })
    // Recent is the newest change to a record they are on (like a group's Recent activity), so Tea comes second.
    await s.createExpense({
      ...base,
      title: 'Tea',
      total: '2000',
      payers: {[s.me]: '2000'},
      split: {mode: 'equal', participants: [s.me, small]},
      date: '2026-10-25',
    })
  })
  const order = () =>
    page
      .locator(
        '[data-testid^="person-"][data-testid$="Small"], [data-testid^="person-"][data-testid$="Big"]',
      )
      .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  await page.goto('/people')
  await expect(page.getByTestId('person-Zoya Big')).toBeVisible()
  expect(await order()).toEqual(['person-Zoya Big', 'person-Aarav Small'])
  await setPref(page, 'peopleSort', 'recent')
  await expect.poll(order).toEqual(['person-Aarav Small', 'person-Zoya Big'])
})

test('UPI pay link shows only when I owe them rupees, and asks before recording', async ({
  page,
}) => {
  await openApp(page)
  const [owedINR, owedUSD] = await page.evaluate(async () => {
    const s = (window as unknown as {splito: SplitoDevTools}).splito
    const a = await s.createPerson('Meera Iyer')
    const b = await s.createPerson('Tom Hale')
    const base = {
      groupId: null,
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      date: '2026-10-20',
    }
    await s.createExpense({
      ...base,
      title: 'Lunch',
      currency: 'INR',
      total: '30000',
      payers: {[a]: '30000'},
      split: {mode: 'equal', participants: [s.me, a]},
    })
    await s.createExpense({
      ...base,
      title: 'Taxi',
      currency: 'USD',
      total: '3000',
      payers: {[b]: '3000'},
      split: {mode: 'equal', participants: [s.me, b]},
    })
    return [a, b]
  })

  await page.goto(`/people/${owedUSD}`)
  await expect(page.getByTestId('person-direction-USD')).toHaveText('You owe')
  await expect(page.getByTestId('person-upi')).toHaveCount(0)

  await page.goto(`/people/${owedINR}`)
  await expect(page.getByTestId('person-direction-INR')).toHaveText('You owe')
  await page.getByTestId('person-upi').click()
  await expect(page.getByTestId('upi-amount')).toHaveValue('150.00')
  // No UPI ID yet, so the sheet's primary action waits for one.
  await expect(page.getByTestId('sheet-save')).toHaveText('Open UPI app')
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('upi-id').fill('meera@okhdfc')
  // The e2e build records the UPI link (lib/openExternal) instead of handing it to the OS.
  await page.getByTestId('sheet-save').click()
  // The e2e build records the hand-off instead of opening a UPI app.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as {__splitoTest?: {externalUrls: string[]}}).__splitoTest?.externalUrls[0],
      ),
    )
    .toBe(
      'upi://pay?pa=meera%40okhdfc&pn=Meera%20Iyer&am=150.00&cu=INR&tn=Splito',
    )
  await expect(page.getByTestId('upi-confirm')).toBeVisible()
  // Nothing is recorded until the user says it went through.
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await page.getByTestId('upi-sheet').getByTestId('sheet-save').click()
  await expect(page.getByTestId('payment-sentence')).toHaveText(
    'You paid Meera Iyer',
  )
  await expect(page.getByTestId('payment-amount')).toHaveValue('150.00')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-settled')).toBeVisible()
  // The UPI ID is remembered on the friend.
  await expect(page.getByText('meera@okhdfc')).toBeVisible()
})

test('add a friend, then land on their page', async ({page}) => {
  await openApp(page)
  await page.goto('/friends/new')
  // A sheet: the primary action at the bottom, off until there is a name. A name alone is a private friend (26.18).
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('add-friend-name').fill('Nikhil Das')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-name')).toHaveText('Nikhil Das')
  await expect(page.getByTestId('person-settled')).toBeVisible()
  await expect(page.getByTestId('person-history-empty')).toBeVisible()
})

test('compose brings the friend: the sidebar pill on desktop, the FAB and the page’s own button on phones (owner 190)', async ({
  page,
}) => {
  await openApp(page)
  const {kavya} = await seedA04(page)
  await page.setViewportSize(LAPTOP)
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('fab-add')).toHaveCount(0)
  await page.getByTestId('sidebar-add').click()
  await expect(page).toHaveURL(new RegExp(`/expense/new\\?personId=${kavya}`))

  await page.setViewportSize(PHONE)
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('screen-person')).toBeVisible()
  await expect(page.getByTestId('screen-person').getByTestId('fab-add')).toBeVisible()
  await page.getByTestId('screen-person').getByTestId('fab-add').click()
  await expect(page).toHaveURL(new RegExp(`/expense/new\\?personId=${kavya}`))
  await page.goBack()
  await page.getByTestId('person-add-expense').click()
  await expect(page).toHaveURL(new RegExp(`/expense/new\\?personId=${kavya}`))
})

test('an unknown friend shows an honest not-found state', async ({page}) => {
  await openApp(page)
  await page.goto('/people/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77')
  await expect(page.getByTestId('person-not-found')).toBeVisible()
})

import {expect, type Page, test} from '@playwright/test'

import {type SplitoDevTools} from '../src/data/devTools'
import {openApp} from './app'
import {BASE} from './seed'
import {SIZES} from './viewports'

/*
 * F-1210 (owner 119): disputes and holds. A participant says "this is wrong" or "wait" without editing the record;
 * it keeps counting in every balance, wears a badge, is left out of Settle up by default, and is answered in the
 * open. Seeded through window.splito; everything else goes through the screens. Each flow runs on a phone (390) and
 * on a desktop (1440).
 */
const DISPUTE_BASE = {...BASE, date: '2026-10-20'}

/** Bob owes me 600 on Dinner (direct) and 450 + 300 in the Goa group; Cara is in Goa too. A 500 payment from Bob. */
async function seed(page: Page) {
  await openApp(page)
  return page.evaluate(async base => {
    const s = (window as unknown as {splito: SplitoDevTools}).splito
    const bob = await s.createPerson('Bob Mehta')
    const cara = await s.createPerson('Cara Rao')
    const group = await s.createGroup({name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [bob]})
    const two = (title: string, total: string, groupId: string | null) =>
      s.createExpense({...base, title, groupId, total, payers: {[s.me]: total}, split: {mode: 'equal', participants: [s.me, bob]}})
    const dinner = await two('Dinner', '120000', null)
    const cab = await two('Cab', '90000', group)
    const lunch = await two('Lunch', '60000', group)
    const bill = await s.createExpense({
      ...base,
      title: 'Bar bill',
      groupId: null,
      total: '100000',
      payers: {[s.me]: '100000'},
      split: {
        mode: 'items',
        items: [
          {id: 'a', name: 'Beer', amount: '60000', participants: [s.me, bob]},
          {id: 'b', name: 'Fries', amount: '40000', participants: [bob]},
        ],
        tax: '0',
        tip: '0',
        discount: '0',
      },
    })
    const payment = await s.createRepayment({groupId: null, currency: 'INR', from: bob, to: s.me, amount: '50000', date: '2026-10-21', tz: 'Asia/Kolkata', note: ''})
    return {bob, cara, group, dinner, cab, lunch, bill, payment}
  }, DISPUTE_BASE)
}

/** Opens the Dispute sheet from the expense menu, picks a reason and saves it as `by` (default me). */
async function raise(page: Page, id: string, opts: {reason: string; note?: string; amount?: string; by?: string}) {
  await page.goto(`/expense/${id}`)
  await page.getByTestId('expense-menu').click()
  await page.getByTestId('record-report').click()
  await expect(page.getByTestId('dispute-sheet')).toBeVisible()
  if (opts.by) {
    await page.getByTestId('dispute-for-other').click()
    await page.getByTestId(`dispute-by-${opts.by}`).click()
  }
  await page.getByTestId(`dispute-reason-${opts.reason}`).click()
  if (opts.amount) await page.getByTestId('dispute-amount').fill(opts.amount)
  if (opts.note) await page.getByTestId('dispute-note').fill(opts.note)
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('dispute-sheet')).toBeHidden()
}

for (const [label, size] of SIZES) {
  test.describe(`disputes at ${label}`, () => {
    test.use({viewport: size})

    test('raise with a reason, a note and a proposed fix as Bob: badge, card, thread line, balances unchanged and "of which disputed"', async ({page}) => {
      const {bob, dinner} = await seed(page)
      // Other needs a note.
      await page.goto(`/expense/${dinner}`)
      await expect(page.getByTestId('dispute-panel')).toHaveCount(0)
      await page.getByTestId('expense-menu').click()
      await page.getByTestId('record-report').click()
      // One entry: Dispute is chosen, Put on hold is one tap away; nobody is asked "Raised by" unless recording for someone else.
      await expect(page.getByTestId('report-kind-dispute')).toHaveAttribute('aria-checked', 'true')
      await expect(page.getByTestId('report-kind-hold')).toBeVisible()
      await expect(page.getByTestId('dispute-by-Bob Mehta')).toHaveCount(0)
      await page.getByTestId('dispute-reason-other').click()
      await expect(page.getByTestId('sheet-save')).toBeDisabled()
      await page.getByTestId('dispute-note').fill('Looks high')
      await expect(page.getByTestId('sheet-save')).toBeEnabled()
      await page.getByTestId('dispute-reason-wrong_amount').click()
      await page.getByTestId('dispute-for-other').click()
      await page.getByTestId('dispute-by-Bob Mehta').click()
      await expect(page.getByTestId('dispute-recorded-by')).toContainText('Recorded by you')
      await page.getByTestId('dispute-amount').fill('900')
      await page.getByTestId('dispute-note').fill('It was 900')
      await page.getByTestId('sheet-save').click()

      await expect(page.getByTestId('expense-disputed')).toContainText('Disputed')
      const card = page.getByTestId('dispute-card-Bob Mehta')
      await expect(card).toContainText('Wrong amount')
      await expect(card).toContainText('It was 900')
      await expect(card).toContainText('Change the amount to ₹900.00')
      await expect(card).toContainText('recorded by you')
      await expect(page.getByTestId('dispute-line-raised')).toContainText('Bob Mehta disputed this')
      // It still counts: the expense and Bob's balance are as recorded; the balance says how much is disputed.
      await expect(page.getByTestId('expense-detail-amount')).toHaveText('₹1,200.00')
      await page.goto(`/people/${bob}`)
      // Dinner 600, Cab 450, Lunch 300, the bar bill 700, less the 500 payment: the dispute changes none of it.
      await expect(page.getByTestId('person-total-INR')).toHaveText('₹1,550.00')
      await expect(page.getByTestId('person-disputed-INR')).toHaveText('of which ₹600.00 disputed')
      await expect(page.getByTestId(`history-${dinner}-disputed`)).toContainText('Disputed')
    })

    test('accept applies the proposed fix in one tap, as a normal edit with history', async ({page}) => {
      const {bob, dinner} = await seed(page)
      await raise(page, dinner, {reason: 'wrong_amount', amount: '900', by: 'Bob Mehta'})
      await page.getByTestId('dispute-accept').click()
      await expect(page.getByTestId('expense-detail-amount')).toHaveText('₹900.00')
      await expect(page.getByTestId('expense-disputed')).toHaveCount(0)
      await expect(page.getByTestId('dispute-badge-accepted')).toBeVisible()
      await expect(page.getByTestId('dispute-line-accepted')).toContainText('accepted Bob Mehta’s dispute')
      await expect(page.getByTestId('history-edited')).toBeVisible()
      await expect(page.getByTestId('dispute-accept')).toHaveCount(0)
      await page.goto(`/people/${bob}`)
      // The dinner is 450 now: 1,550 less 150, and nothing is disputed any more.
      await expect(page.getByTestId('person-total-INR')).toHaveText('₹1,400.00')
      await expect(page.getByTestId('person-disputed-INR')).toHaveCount(0)
    })

    test('reject needs a reason; the raiser reopens once with a new note, then only an admin could', async ({page}) => {
      const {dinner} = await seed(page)
      await raise(page, dinner, {reason: 'other', note: 'Not sure', by: 'Bob Mehta'})
      await page.getByTestId('dispute-reject').click()
      await expect(page.getByTestId('sheet-save')).toBeDisabled()
      await page.getByTestId('dispute-answer-note').fill('The receipt says 1,200')
      await page.getByTestId('sheet-save').click()
      // The next sheet only opens once this one has gone (a human is slower than that; a script is not).
      await expect(page.getByTestId('dispute-answer-sheet')).toHaveCount(0)
      await expect(page.getByTestId('dispute-badge-rejected')).toBeVisible()
      await expect(page.getByTestId('dispute-resolution-note')).toContainText('The receipt says 1,200')
      await expect(page.getByTestId('expense-disputed')).toHaveCount(0)
      await page.getByTestId('dispute-reopen').click()
      await page.getByTestId('dispute-answer-note').fill('Here is the receipt photo')
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId('dispute-answer-sheet')).toHaveCount(0)
      await expect(page.getByTestId('expense-disputed')).toContainText('Disputed')
      await expect(page.getByTestId('dispute-card-Bob Mehta')).toContainText('reopened')
      await expect(page.getByTestId('dispute-card-Bob Mehta')).toContainText('Here is the receipt photo')
      await expect(page.getByTestId('dispute-line-reopened')).toBeVisible()
      // Rejected again: a second reopen is for an admin, and a direct expense has none.
      await page.getByTestId('dispute-reject').click()
      await page.getByTestId('dispute-answer-note').fill('Still 1,200')
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId('dispute-answer-sheet')).toHaveCount(0)
      await expect(page.getByTestId('dispute-badge-rejected')).toBeVisible()
      await expect(page.getByTestId('dispute-reopen')).toHaveCount(0)
    })

    test('my own dispute can only be withdrawn: no accept or reject', async ({page}) => {
      const {dinner} = await seed(page)
      await raise(page, dinner, {reason: 'not_part', note: 'I was not there'})
      await expect(page.getByTestId('expense-disputed')).toBeVisible()
      await expect(page.getByTestId('dispute-accept')).toHaveCount(0)
      await expect(page.getByTestId('dispute-reject')).toHaveCount(0)
      await page.getByTestId('dispute-withdraw').click()
      await expect(page.getByTestId('dispute-badge-withdrawn')).toBeVisible()
      await expect(page.getByTestId('expense-disputed')).toHaveCount(0)
      await expect(page.getByTestId('dispute-line-withdrawn')).toBeVisible()
      // One open dispute per person per record: raising again is fine once the first is closed.
      await page.getByTestId('expense-menu').click()
      await page.getByTestId('record-report').click()
      await page.getByTestId('dispute-reason-wrong_payer').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId('expense-disputed')).toBeVisible()
      await page.getByTestId('expense-menu').click()
      await page.getByTestId('record-report').click()
      await page.getByTestId('dispute-reason-wrong_payer').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByText('There is already an open dispute or hold from this person on this').first()).toBeVisible()
    })

    test('hold: a required reason, the badge, a one-tap release', async ({page}) => {
      const {dinner} = await seed(page)
      await page.goto(`/expense/${dinner}`)
      await page.getByTestId('expense-menu').click()
      await page.getByTestId('record-report').click()
      await page.getByTestId('report-kind-hold').click()
      await expect(page.getByTestId('sheet-save')).toBeDisabled()
      await page.getByTestId('hold-suggestion-Need the receipt').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId('expense-disputed')).toContainText('On hold')
      await expect(page.getByTestId('dispute-card-You')).toContainText('Need the receipt')
      await expect(page.getByTestId('dispute-line-held')).toBeVisible()
      await expect(page.getByTestId('dispute-accept')).toHaveCount(0)
      await page.getByTestId('dispute-release').click()
      await expect(page.getByTestId('expense-disputed')).toHaveCount(0)
      await expect(page.getByTestId('dispute-badge-released')).toBeVisible()
      await expect(page.getByTestId('dispute-line-released')).toBeVisible()
    })

    test('Settle up leaves disputed and held amounts out, says how much, and "Include disputed" puts them back (remembered per group)', async ({page}) => {
      const {bob, group, lunch} = await seed(page)
      await page.evaluate(([by, target]) => (window as unknown as {splito: SplitoDevTools}).splito.disputeAs(by!, {targetType: 'expense', targetId: target, reason: 'wrong_amount', note: 'x'}), [bob, lunch])
      await page.goto(`/groups/${group}/settle`)
      await expect(page.getByTestId('settle-count-INR')).toHaveText('1 payment')
      await expect(page.getByTestId('transfer-amount')).toContainText('₹450.00')
      await expect(page.getByTestId('settle-disputed-notice')).toContainText('₹300.00 disputed or on hold, not in this plan.')
      const hashBefore = await page.getByTestId('settle-footer').getAttribute('data-plan-hash')
      await page.getByTestId('settle-include-disputed').click()
      await expect(page.getByTestId('transfer-amount')).toContainText('₹750.00')
      await expect(page.getByTestId('settle-disputed-notice')).toContainText('₹300.00 disputed or on hold is in this plan.')
      expect(await page.getByTestId('settle-footer').getAttribute('data-plan-hash')).not.toBe(hashBefore)
      // Remembered for this group.
      await page.reload()
      await expect(page.getByTestId('transfer-amount')).toContainText('₹750.00')
      await page.getByTestId('settle-exclude-disputed').click()
      await expect(page.getByTestId('transfer-amount')).toContainText('₹450.00')
    })

    test('a settled group whose record is disputed afterwards has no plan and no notice; nobody is asked to pay twice', async ({page}) => {
      const {bob} = await seed(page)
      const {group, trip} = await page.evaluate(
        async ([b, base]) => {
          const s = (window as unknown as {splito: SplitoDevTools}).splito
          const group = await s.createGroup({name: 'Trip two', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [b]})
          const trip = await s.createExpense({...(base as object), title: 'Trip dinner', groupId: group, total: '60000', payers: {[s.me]: '60000'}, split: {mode: 'equal', participants: [s.me, b]}})
          await s.createRepayment({groupId: group, currency: 'INR', from: b, to: s.me, amount: '30000', date: '2026-10-21', tz: 'Asia/Kolkata', note: ''})
          await s.disputeAs(b as string, {targetType: 'expense', targetId: trip, reason: 'other', note: 'x'})
          return {group, trip}
        },
        [bob, DISPUTE_BASE] as const,
      )
      expect(trip).toBeTruthy()
      await page.goto(`/groups/${group}/settle`)
      await expect(page.getByTestId('settle-settled-INR')).toBeVisible()
      await expect(page.getByTestId('settle-disputed-notice')).toHaveCount(0)
      await expect(page.getByTestId('transfer-amount')).toHaveCount(0)
    })

    test("a friend's Settle up prefills without the disputed part and says so; Include disputed puts it back", async ({page}) => {
      const {bob, dinner} = await seed(page)
      await page.evaluate(([by, target]) => (window as unknown as {splito: SplitoDevTools}).splito.disputeAs(by!, {targetType: 'expense', targetId: target, reason: 'other', note: 'x'}), [bob, dinner])
      await page.goto(`/people/${bob}`)
      await expect(page.getByTestId('person-disputed-notice')).toContainText('₹600.00 disputed or on hold, not included in Settle up or Call it even.')
      await page.getByTestId('person-record-payment').click()
      // 1,550 owed less the 600 in dispute.
      await expect(page.getByTestId('payment-amount')).toHaveValue(/^950(\.00)?$/)
      await page.getByTestId('sheet-cancel').click()
      await page.getByTestId('person-include-disputed').click()
      await expect(page.getByTestId('person-disputed-notice')).toContainText('is included in Settle up and Call it even')
      await page.getByTestId('person-record-payment').click()
      await expect(page.getByTestId('payment-amount')).toHaveValue(/^1,?550(\.00)?$/)
    })

    test('a fix that would change how the bill is split is not one tap: only "Edit it", with the reason', async ({page}) => {
      const {bob, bill, dinner} = await seed(page)
      await page.evaluate(
        ([by, target, other]) => {
          const s = (window as unknown as {splito: SplitoDevTools}).splito
          return Promise.all([
            s.disputeAs(by!, {targetType: 'expense', targetId: target, reason: 'wrong_amount', note: '', proposedFix: {kind: 'amount', amount: '90000'}}),
            s.disputeAs(by!, {targetType: 'expense', targetId: other, reason: 'wrong_amount', note: '', proposedFix: {kind: 'amount', amount: '90000'}}),
          ])
        },
        [bob, bill, dinner],
      )
      await page.goto(`/expense/${bill}`)
      await expect(page.getByTestId('dispute-blocked')).toContainText('can’t be applied in one tap')
      await expect(page.getByTestId('dispute-accept')).toHaveCount(0)
      await expect(page.getByTestId('dispute-edit')).toBeVisible()
      await expect(page.getByTestId('dispute-reject')).toBeVisible()
      // An equal split keeps its rule, and the panel says what accepting does.
      await page.goto(`/expense/${dinner}`)
      await expect(page.getByTestId('dispute-will-do')).toContainText('applies this change as an edit')
      await expect(page.getByTestId('dispute-accept')).toBeVisible()
    })

    test('the group Balances and Person pages say how much of a balance is disputed', async ({page}) => {
      const {bob, group, cab} = await seed(page)
      await page.evaluate(([by, target]) => (window as unknown as {splito: SplitoDevTools}).splito.holdAs(by!, {targetType: 'expense', targetId: target, note: 'refund'}), [bob, cab])
      await page.goto(`/groups/${group}`)
      await expect(page.getByTestId('group-disputed-INR')).toHaveText('of which ₹450.00 disputed')
      await page.goto(`/groups/${group}/balances`)
      await expect(page.getByTestId('group-balances-disputed-INR')).toHaveText('of which ₹450.00 disputed')
      await page.goto(`/people/${bob}`)
      await expect(page.getByTestId('person-disputed-INR')).toHaveText('of which ₹450.00 disputed')
    })

    test('the Disputed filter on a group, a person, Activity and Search', async ({page}) => {
      const {bob, group, cab, lunch, dinner} = await seed(page)
      await page.evaluate(([by, target]) => (window as unknown as {splito: SplitoDevTools}).splito.disputeAs(by!, {targetType: 'expense', targetId: target, reason: 'other', note: 'x'}), [bob, lunch])
      // Group Expenses.
      await page.goto(`/groups/${group}`)
      await expect(page.getByTestId(`history-${cab}`)).toBeVisible()
      await expect(page.getByTestId(`history-${lunch}-disputed`)).toBeVisible()
      await page.getByTestId('group-filter').click()
      await page.getByTestId('filter-disputed').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId(`history-${lunch}`)).toBeVisible()
      await expect(page.getByTestId(`history-${cab}`)).toHaveCount(0)
      await expect(page.getByTestId('group-filter-disputed')).toBeVisible()
      // Person history.
      await page.goto(`/people/${bob}`)
      await page.getByTestId('person-filter').click()
      await page.getByTestId('filter-disputed').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId(`history-${lunch}`)).toBeVisible()
      await expect(page.getByTestId(`history-${dinner}`)).toHaveCount(0)
      // Activity.
      await page.goto('/activity?tab=all&type=disputes')
      await expect(page.getByText('Bob Mehta disputed Lunch').first()).toBeVisible()
      await expect(page.getByText('added Dinner')).toHaveCount(0)
      // Search: `status: disputed` keeps the disputed expenses; with words, the matches among them.
      await page.goto('/')
      await page.getByTestId('header-search-ask').click()
      await expect(page.getByTestId('search-input')).toBeFocused()
      await expect(page.getByTestId('search-input')).toBeEditable()
      await page.getByTestId('search-input').fill('status: disputed')
      await expect(page.getByTestId('search-ask').getByText('Lunch').first()).toBeVisible()
      await expect(page.getByTestId('search-ask').getByText('Cab')).toHaveCount(0)
      await page.getByTestId('search-input').fill('status:disputed dinner')
      await expect(page.getByTestId('search-ask').getByText('Lunch')).toHaveCount(0)
    })

    test('editing a disputed expense asks "Does this resolve Bob’s dispute?"; yes accepts it, deleting closes the rest as Gone', async ({page}) => {
      const {bob, dinner, lunch} = await seed(page)
      await raise(page, dinner, {reason: 'wrong_amount', by: 'Bob Mehta'})
      await page.getByTestId('expense-edit-button').click()
      await page.getByTestId('amount-input').fill('1000')
      await page.getByTestId('sheet-save').click()
      await expect(page.getByText('Does this resolve Bob Mehta’s dispute?')).toBeVisible()
      await page.getByTestId('resolve-yes').click()
      await expect(page.getByText(/Expense added|Changes saved/)).toBeVisible()
      await page.goto(`/expense/${dinner}`)
      await expect(page.getByTestId('expense-detail-amount')).toHaveText('₹1,000.00')
      await expect(page.getByTestId('dispute-badge-accepted')).toBeVisible()
      await expect(page.getByTestId('expense-disputed')).toHaveCount(0)
      // Deleting a disputed record closes the dispute as Gone.
      await page.evaluate(([by, target]) => (window as unknown as {splito: SplitoDevTools}).splito.disputeAs(by!, {targetType: 'expense', targetId: target, reason: 'other', note: 'x'}), [bob, lunch])
      await page.goto(`/expense/${lunch}`)
      await expect(page.getByTestId('expense-disputed')).toBeVisible()
      await page.getByTestId('expense-menu').click()
      await page.getByTestId('expense-delete').click()
      await expect(page.getByText('Expense deleted')).toBeVisible()
      await page.goto(`/expense/${lunch}`)
      await expect(page.getByTestId('dispute-badge-gone')).toBeVisible()
      await expect(page.getByTestId('dispute-line-gone')).toBeVisible()
      await expect(page.getByTestId('expense-disputed')).toHaveCount(0)
    })

    test('one item of a bill: dispute my portion, an item badge, balances still count it', async ({page}) => {
      const {bill} = await seed(page)
      await page.goto(`/expense/${bill}`)
      await page.getByTestId('item-dispute-0').click()
      await expect(page.getByTestId('dispute-sheet')).toBeVisible()
      await expect(page.getByTestId('dispute-reason-left_out')).toHaveCount(0)
      await page.getByTestId('dispute-reason-wrong_share').click()
      await page.getByTestId('dispute-note').fill('I only had one')
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId('expense-item-0-disputed')).toContainText('Disputed')
      await expect(page.getByTestId('item-dispute-0')).toHaveCount(0)
      // Fries is Bob's alone: no "Dispute my portion" for me there.
      await expect(page.getByTestId('item-dispute-1')).toHaveCount(0)
      await expect(page.getByTestId('dispute-card-You')).toContainText('one item')
      await expect(page.getByTestId('expense-detail-amount')).toHaveText('₹1,000.00')
    })

    test('a payment "not received": raised from its details, accepted and applied (the payment goes)', async ({page}) => {
      const {bob, payment} = await seed(page)
      await page.goto(`/people/${bob}`)
      await page.getByTestId(`history-${payment}`).click()
      await page.getByTestId('payment-report').click()
      await expect(page.getByTestId('dispute-sheet')).toBeVisible()
      // Bob is the one who says it was not received: recorded for him, so someone else (me) can answer it.
      await page.getByTestId('dispute-for-other').click()
      await page.getByTestId('dispute-by-Bob Mehta').click()
      await page.getByTestId('dispute-reason-not_received').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId('dispute-sheet')).toBeHidden()
      await page.goto(`/payment/${payment}`)
      await expect(page.getByTestId('repayment-disputed')).toContainText('Disputed')
      await expect(page.getByTestId('dispute-line-raised')).toBeVisible()
      // Accepted with the fix (a payment not received goes), it no longer counts.
      await page.getByTestId('dispute-accept').click()
      await expect(page.getByTestId('repayment-deleted')).toBeVisible()
      await expect(page.getByTestId('dispute-badge-accepted')).toBeVisible()
    })

    test('CSV export has a dispute column', async ({page}, info) => {
      const {bob, dinner} = await seed(page)
      await page.evaluate(([by, target]) => (window as unknown as {splito: SplitoDevTools}).splito.disputeAs(by!, {targetType: 'expense', targetId: target, reason: 'other', note: 'x'}), [bob, dinner])
      await page.goto(`/people/${bob}`)
      await page.getByTestId('person-more').click()
      await page.getByTestId('person-export').click()
      await page.getByTestId('export-format-csv').click()
      const download = page.waitForEvent('download')
      await page.getByTestId('sheet-save').click()
      const file = info.outputPath('statement.csv')
      await (await download).saveAs(file)
      const csv = (await import('node:fs')).readFileSync(file, 'utf8').replace(/^﻿/, '')
      const lines = csv.trim().split('\r\n')
      expect(lines[0]).toMatch(/,Dispute$/)
      expect(lines.some(l => l.includes('Dinner') && l.endsWith(',Disputed'))).toBe(true)
      expect(lines.some(l => l.includes('Cab') && l.endsWith(','))).toBe(true)
    })
  })
}

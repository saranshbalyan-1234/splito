import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'
import {
  balanceRows,
  balanceTotals,
  computeShares,
  type ExpenseRecord,
  formatAmount,
  magnitude,
  personSummary,
} from '@splito/domain'

import {DEMO_EXPENSES, DEMO_FRIENDS} from '../src/data/demoData'

/* Expected balances, recomputed from the demo dataset with the same domain rules the app uses. */
const LOCALE = 'en-US' // Playwright's default browser locale; `auto` number format follows it.
const records: ExpenseRecord[] = DEMO_EXPENSES.map((e, i) => ({
  kind: 'expense',
  id: `e${i}`,
  groupId: e.group,
  currency: e.currency,
  total: e.total,
  payers: e.payers as Record<string, bigint>,
  shares: computeShares(e.total, {mode: 'equal', participants: e.participants}),
  date: e.date,
  deleted: false,
}))
// Group parts follow each group's settle-up plan, as the app shows them (`balanceRows`; demo groups have no rules).
const summaries = personSummary(balanceRows(records, 'me'), {includeGroups: true})
const byKey = new Map(summaries.map(s => [s.person, s]))

/* Every compiled message id, so the UI can be checked for ids shown instead of words. */
const MESSAGE_IDS = Object.keys(
  JSON.parse(
    JSON.parse(
      readFileSync(join(__dirname, '../src/locale/locales/en/messages.ts'), 'utf8').match(/JSON\.parse\(("(?:[^"\\]|\\.)*")\)/)![1]!,
    ),
  ),
)

async function openDemo(page: Page) {
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
}

async function expectNoMessageIds(page: Page) {
  const text = await page.locator('body').innerText()
  const words = new Set(text.split(/\s+/))
  expect(MESSAGE_IDS.filter(id => words.has(id))).toEqual([])
}

test('People shows each friend with real words and the right balance per currency', async ({page}) => {
  await openDemo(page)
  for (const [key, name] of Object.entries(DEMO_FRIENDS)) {
    const row = page.getByTestId(`person-${name}`)
    await expect(row).toBeVisible()
    // A friend whose group debts the settle-up plan routes to others has nothing open with me.
    const summary = byKey.get(key)
    if (!summary) {
      await expect(row).toContainText('settled up')
      continue
    }
    for (const [currency, {total}] of Object.entries(summary.byCurrency)) {
      const words = total > 0n ? 'owes you' : 'you owe'
      await expect(row.getByTestId(`balance-${currency}`)).toHaveText(`${words} ${formatAmount(magnitude(total), currency, LOCALE)}`)
    }
  }
  await expect(page.getByTestId('people-balances-title')).toHaveText('Balances')
  await expect(page.getByTestId('people-friends-title')).toHaveText(
    `Friends  ${Object.keys(DEMO_FRIENDS).length}`,
  )
  await expect(page.getByTestId('people-add-friend')).toHaveAttribute('aria-label', 'Add friend')
  await expectNoMessageIds(page)
})

test('the summary shows one card per currency, never summed across, and opens Analytics', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800})
  await openDemo(page)
  for (const {currency, net} of balanceTotals(summaries)) {
    await expect(page.getByTestId(`summary-${currency}-net`)).toHaveText(formatAmount(magnitude(net), currency, LOCALE))
  }
  await page.getByTestId('summary-INR').click()
  await expect(page.getByTestId('screen-analytics')).toBeVisible()
})

test('a person row opens that person', async ({page}) => {
  await openDemo(page)
  await page.getByTestId('person-Riya Sharma').click()
  await expect(page).toHaveURL(/\/people\/[^/]+$/)
  await expect(page.getByTestId('screen-person')).toBeVisible()
})

test('Groups lists the demo groups with my balance in each', async ({page}) => {
  await openDemo(page)
  await page.goto('/groups')
  for (const name of ['Goa trip', 'Flat 4B', 'Lisbon']) {
    await expect(page.getByTestId(`group-${name}`)).toBeVisible()
  }
  await expect(page.getByTestId('group-Lisbon').getByTestId('group-balance-EUR')).toHaveText(/^you owe €/)
  await expect(page.getByTestId('group-Goa trip').getByTestId('group-balance-INR')).toHaveText(/^you are owed ₹/)
  await expectNoMessageIds(page)
})

test('Hindi renders translated words with Indian grouping, never message ids', async ({page}) => {
  await openDemo(page)
  await page.evaluate(() => (window as any).splito.setPref('language', 'hi'))
  await expect(page.getByTestId('people-balances-title')).toHaveText('बैलेंस')
  await expect(page.getByTestId('people-friends-title')).toHaveText(/^दोस्त/)
  await expect(page.getByTestId('people-add-friend')).toHaveAttribute('aria-label', 'दोस्त जोड़ें')
  const arjun = byKey.get('arjun')!.byCurrency.INR!.total
  await expect(page.getByTestId('person-Arjun Mehta').getByTestId('balance-INR')).toHaveText(
    `आपको मिलेंगे ${formatAmount(arjun, 'INR', 'hi-IN')}`,
  )
  await expectNoMessageIds(page)
})

test('Profile is Bluesky settings-style with Analytics, Settings and About', async ({page}) => {
  await openDemo(page)
  await page.goto('/profile')
  await expect(page.getByTestId('profileHeaderDisplayName')).toBeVisible()
  await expect(page.getByTestId('profile-analytics')).toBeVisible()
  await expect(page.getByTestId('profile-about')).toBeVisible()
  await page.getByTestId('profile-settings').click()
  await expect(page.getByTestId('screen-settings')).toBeVisible()
})

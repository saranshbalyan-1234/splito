import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

import {openDemo, showSettled} from './openDemo'
import {
  balanceRows,
  balanceSides,
  balanceTotals,
  formatAmount,
  isSettledBalance,
  magnitude,
  personSummary,
} from '@splito/domain'
import {DEMO_LARGE_PREFIX, generateLargeDemo, localToday, planLedger} from '@splito/sync/demoLarge'

/*
 * Expected balances, recomputed from the one demo dataset with the same domain
 * rules the app uses: the generator is deterministic for a day, so the spec
 * rebuilds exactly the plan the app wrote.
 */
const LOCALE = 'en-US' // Playwright's default browser locale; `auto` number format follows it.
// "Me" is the demo database's own person (`demoSeed.ts` DEMO_ME): remainders are shared out by id order, so the id must be the app's.
const ME = `${DEMO_LARGE_PREFIX}me`
const plan = generateLargeDemo({me: ME, today: localToday(), now: Date.now()})
// Group parts follow each group's settle-up plan, as the app shows them (`balanceRows`; demo groups have no rules).
const summaries = personSummary(balanceRows(planLedger(plan), ME), {includeGroups: true})
const byId = new Map(summaries.map(s => [s.person, s]))
/** The six friends of the curated story, whose numbers the dataset fixes. */
const STORY = {
  riya: 'Riya Sharma',
  arjun: 'Arjun Mehta',
  priya: 'Priya Nair',
  sam: 'Sam Carter',
  lena: 'Lena Fischer',
  diego: 'Diego Alves',
} as const
const summaryOf = (key: string) => byId.get(`${DEMO_LARGE_PREFIX}p-${key}`)
/**
 * The generated friends plus the 3 private friends of the invites flow (`demoSeed.ts`), less the deleted and the removed
 * friend of the Wave B story, who leave the count, plus Sara, whose request to join Goa was approved (F-269).
 */
const FRIENDS = plan.counts.people + 3 - 2 + 1

/* Every compiled message id, so the UI can be checked for ids shown instead of words. */
const MESSAGE_IDS = Object.keys(
  JSON.parse(
    JSON.parse(
      readFileSync(
        join(__dirname, '../src/locale/locales/en/messages.ts'),
        'utf8',
      ).match(/JSON\.parse\(("(?:[^"\\]|\\.)*")\)/)![1]!,
    ),
  ),
)

/** Scrolls the virtualised list until a row is mounted (the dataset has dozens of friends and groups). */
async function reveal(page: Page, testID: string) {
  const row = page.getByTestId(testID)
  for (let i = 0; i < 60 && (await row.count()) === 0; i++) {
    await page.mouse.move(700, 500)
    await page.mouse.wheel(0, 700)
    await page.waitForTimeout(60)
  }
  await row.scrollIntoViewIfNeeded()
  return row
}

async function expectNoMessageIds(page: Page) {
  const text = await page.locator('body').innerText()
  const words = new Set(text.split(/\s+/))
  expect(MESSAGE_IDS.filter(id => words.has(id))).toEqual([])
}

test('People shows each friend with real words and the right balance per currency', async ({
  page,
}) => {
  await openDemo(page, '/people')
  await showSettled(page)
  for (const [key, name] of Object.entries(STORY)) {
    const row = await reveal(page, `person-${name}`)
    await expect(row).toBeVisible()
    // A friend whose group debts the settle-up plan routes to others has nothing open with me.
    const summary = summaryOf(key)
    if (!summary) {
      await expect(row).toContainText('Settled up')
      continue
    }
    // One net per currency (26.12, owner 120); only a currency open both ways that nets to zero keeps two lines (F-113 M10).
    for (const [currency, balance] of Object.entries(summary.byCurrency)) {
      if (isSettledBalance(balance)) continue
      const {owed, owe} = balanceSides(balance)
      const money = (v: bigint) => formatAmount(v, currency, LOCALE)
      if (owed > 0n && owe > 0n && balance.total === 0n) {
        await expect(row.getByTestId(`balance-${currency}-owed`)).toHaveText(`owes you ↙ ${money(owed)}`)
        await expect(row.getByTestId(`balance-${currency}-owe`)).toHaveText(`you owe ↗ ${money(owe)}`)
      } else {
        const net = balance.total
        await expect(row.getByTestId(`balance-${currency}`)).toHaveText(
          net > 0n ? `owes you ↙ ${money(net)}` : `you owe ↗ ${money(-net)}`,
        )
      }
    }
  }
  await expect(page.getByTestId('people-friends-title')).toHaveText(
    `Friends  ${FRIENDS}`,
  )
  // Invite people is the header's one action (an icon button), not repeated in the list; no overflow.
  await expect(page.getByTestId('people-add-friend')).toHaveAttribute(
    'aria-label',
    'Invite people',
  )
  await expect(page.getByTestId('people-more')).toHaveCount(0)
  await expectNoMessageIds(page)
})

test('the summary (top of Analytics) shows one card per currency, never summed across, and narrows Analytics to the card', async ({
  page,
}) => {
  await page.setViewportSize({width: 1280, height: 800})
  await openDemo(page, '/analytics')
  for (const {currency, net} of balanceTotals(summaries)) {
    await expect(page.getByTestId(`summary-${currency}-net`)).toHaveText(
      formatAmount(magnitude(net), currency, LOCALE),
    )
  }
  await page.getByTestId('summary-INR').click()
  await expect(page.getByTestId('screen-analytics')).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('currency')).toBe('INR')
})

test('a person row opens that person', async ({page}) => {
  await openDemo(page, '/people')
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
  await expect(
    page.getByTestId('group-Lisbon').getByTestId('group-balance-EUR'),
  ).toHaveText(/^you owe\s*↗\s€/)
  await expect(
    page.getByTestId('group-Goa trip').getByTestId('group-balance-INR'),
  ).toHaveText(/^you are owed\s*↙\s₹/)
  // No Overview on Groups: it is the top of Analytics (owner 198).
  await expect(page.getByTestId('groups-balances')).toHaveCount(0)
  await expectNoMessageIds(page)
})

test('Hindi renders translated words with Indian grouping, never message ids', async ({
  page,
}) => {
  await openDemo(page, '/people')
  await page.evaluate(() => (window as any).splito.setPref('language', 'hi'))
  await expect(page.getByTestId('people-friends-title')).toHaveText(/^दोस्त/)
  await expect(page.getByTestId('people-add-friend')).toHaveAttribute(
    'aria-label',
    'लोगों को आमंत्रित करें',
  )
  const arjun = summaryOf('arjun')!.byCurrency.INR!.total
  await expect(
    (await reveal(page, 'person-Arjun Mehta')).getByTestId('balance-INR'),
  ).toHaveText(`आपको मिलेंगे ↙ ${formatAmount(arjun, 'INR', 'hi-IN')}`)
  await expectNoMessageIds(page)
})

test('Profile holds identity: name prompt, counts, then Settings and About; no dead sync row', async ({
  page,
}) => {
  await openDemo(page)
  await page.goto('/profile')
  await expect(page.getByTestId('profileHeaderDisplayName')).toBeVisible()
  // The starting name "Me" asks for a real one.
  await expect(page.getByTestId('profile-edit')).toHaveAttribute(
    'aria-label',
    'Add your name',
  )
  await expect(page.getByTestId('profile-stat-friends')).toContainText(
    String(FRIENDS),
  )
  await expect(page.getByTestId('profile-stat-groups')).toContainText(String(plan.counts.groups - 2)) // less the hidden and the deleted group of the Wave B story
  await expect(page.getByTestId('profile-analytics')).toHaveCount(0)
  await expect(page.getByText('Coming with sync')).toHaveCount(0)
  await expect(page.getByTestId('profile-sync-note')).toBeVisible()
  /* Profile holds only the person and Log out (owners 202, 203): no Settings or About rows. */
  await expect(page.getByTestId('profile-log-out')).toBeVisible()
  await expect(page.getByTestId('profile-settings')).toHaveCount(0)
  await expect(page.getByTestId('profile-about')).toHaveCount(0)
})

test('Analytics: the Overview counts friends; People: the Friends list has its own search beside Filters', async ({
  page,
}) => {
  await page.setViewportSize({width: 390, height: 844})
  await openDemo(page, '/analytics')
  const analytics = page.getByTestId('screen-analytics')
  const settled = FRIENDS - summaries.filter(s => s.person !== ME).length
  await expect(analytics.getByTestId('analytics-overview-counts')).toHaveText(
    `${FRIENDS} friends · ${settled} settled`,
  )
  // Balances right now come first, above the filter row they ignore (owner 198).
  await expect(analytics.getByTestId('analytics-overview-title')).toHaveText('Balances right now')
  await page.goto('/people')
  const people = page.getByTestId('screen-people')
  // The list's own search (owner 91) sits beside Filters, besides the header's Search & Ask.
  await expect(people.getByTestId('list-search')).toBeVisible()
  await expect(people.getByTestId('list-filters')).toBeVisible()
  await expect(people.getByTestId('header-search-ask')).toBeVisible()
  await expect(people.getByTestId('analytics-overview')).toHaveCount(0)
})

test('Groups: Overview, search by member, and type / status filters', async ({
  page,
}) => {
  await openDemo(page)
  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()
  await expect(groups.getByTestId('groups-balances')).toHaveCount(0)
  // Search finds a group by who is in it.
  await groups.getByTestId('list-search').click()
  await groups.getByTestId('list-search-input').fill('lena')
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()
  await expect(groups.getByTestId('group-Goa trip')).toHaveCount(0)
  await groups.getByTestId('searchTextInputClearBtn').click()

  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-type-home').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('group-Flat 4B')).toBeVisible()
  await expect(groups.getByTestId('group-Lisbon')).toHaveCount(0)
  await expect(groups.getByTestId('list-filters-dot')).toBeVisible()
  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-type-all').click()
  await page.getByTestId('filter-status-inactive').click()
  await page.getByTestId('sheet-save').click()
  // The Wave B story's inactive group (F-604) is the only one; no home group is inactive.
  await expect(groups.getByTestId('group-Old office chai')).toBeVisible()
  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-type-home').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('groups-filtered-empty')).toBeVisible()
  await groups.getByTestId('groups-clear-filters').click()
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()
})

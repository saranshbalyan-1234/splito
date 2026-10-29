import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'
import {
  balanceRows,
  balanceSides,
  balanceTotals,
  formatAmount,
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
/** The generated friends plus the 3 private friends of the invites flow (`demoSeed.ts`): none owes anything. */
const FRIENDS = plan.counts.people + 3

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
  await openDemo(page)
  for (const [key, name] of Object.entries(STORY)) {
    const row = await reveal(page, `person-${name}`)
    await expect(row).toBeVisible()
    // A friend whose group debts the settle-up plan routes to others has nothing open with me.
    const summary = summaryOf(key)
    if (!summary) {
      await expect(row).toContainText('Settled up')
      continue
    }
    // Each way on its own line, never netted across direct and groups (F-113 M10).
    for (const [currency, balance] of Object.entries(summary.byCurrency)) {
      const {owed, owe} = balanceSides(balance)
      const money = (v: bigint) => formatAmount(v, currency, LOCALE)
      const isBoth = owed > 0n && owe > 0n
      if (owed > 0n)
        await expect(
          row.getByTestId(
            isBoth ? `balance-${currency}-owed` : `balance-${currency}`,
          ),
        ).toHaveText(`owes you ↙ ${money(owed)}`)
      if (owe > 0n)
        await expect(
          row.getByTestId(
            isBoth ? `balance-${currency}-owe` : `balance-${currency}`,
          ),
        ).toHaveText(`you owe ↗ ${money(owe)}`)
    }
  }
  await expect(page.getByTestId('people-balances-title')).toHaveText('Overview')
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

test('the summary shows one card per currency, never summed across, and opens Analytics', async ({
  page,
}) => {
  await page.setViewportSize({width: 1280, height: 800})
  await openDemo(page)
  for (const {currency, net} of balanceTotals(summaries)) {
    await expect(page.getByTestId(`summary-${currency}-net`)).toHaveText(
      formatAmount(magnitude(net), currency, LOCALE),
    )
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
  await expect(
    page.getByTestId('group-Lisbon').getByTestId('group-balance-EUR'),
  ).toHaveText(/^you owe\s*↗\s€/)
  await expect(
    page.getByTestId('group-Goa trip').getByTestId('group-balance-INR'),
  ).toHaveText(/^you are owed\s*↙\s₹/)
  // An Overview on top, People's style: one cell per currency, never added together.
  await expect(page.getByTestId('groups-balances-title')).toHaveText('Overview')
  await expect(
    page.getByTestId('groups-balances').getByTestId('summary-INR-net'),
  ).toBeVisible()
  await expect(
    page.getByTestId('groups-balances').getByTestId('summary-EUR-net'),
  ).toBeVisible()
  await expectNoMessageIds(page)
})

test('Hindi renders translated words with Indian grouping, never message ids', async ({
  page,
}) => {
  await openDemo(page)
  await page.evaluate(() => (window as any).splito.setPref('language', 'hi'))
  await expect(page.getByTestId('people-balances-title')).toHaveText('सारांश')
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
  await expect(page.getByTestId('profile-stat-groups')).toContainText(String(plan.counts.groups))
  await expect(page.getByTestId('profile-analytics')).toHaveCount(0)
  await expect(page.getByText('Coming with sync')).toHaveCount(0)
  await expect(page.getByTestId('profile-sync-note')).toBeVisible()
  await expect(page.getByTestId('profile-about')).toBeVisible()
  await page.getByTestId('profile-settings').click()
  await expect(page.getByTestId('screen-settings')).toBeVisible()
})

test('People: the Overview counts friends; search lives in the Search & Ask drawer, not in the list', async ({
  page,
}) => {
  await page.setViewportSize({width: 390, height: 844})
  await openDemo(page)
  const people = page.getByTestId('screen-people')
  const settled = FRIENDS - summaries.filter(s => s.person !== ME).length
  await expect(people.getByTestId('people-summary-counts')).toHaveText(
    `${FRIENDS} friends · ${settled} settled`,
  )
  await expect(people.getByTestId('overview-analytics')).toBeVisible()
  // Home has no list search of its own: the header's Search & Ask drawer searches everything.
  await expect(people.getByTestId('list-search')).toHaveCount(0)
  await expect(people.getByTestId('header-search-ask')).toBeVisible()
})

test('Groups: Overview, search by member, and type / status filters', async ({
  page,
}) => {
  await openDemo(page)
  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()
  await expect(groups.getByTestId('groups-balances-counts')).toHaveText(
    /^15 groups · \d+ settled$/,
  )
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
  await page.getByTestId('filter-status-archived').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('groups-filtered-empty')).toBeVisible()
  await groups.getByTestId('groups-clear-filters').click()
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()
})

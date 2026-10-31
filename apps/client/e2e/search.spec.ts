import {expect, type Locator, type Page, test} from '@playwright/test'

import {formatAmount, getCurrency} from '@splito/domain'
import {DEMO_LARGE_PREFIX, generateLargeDemo, localToday, planRecords} from '@splito/sync/demoLarge'

import {openDemo} from './openDemo'

/*
 * What a search for a word must show, computed from the same deterministic plan the app seeded (as demo.spec does):
 * the expenses whose title, notes or item names start with it, newest first (the day, then the later-created first),
 * and one total per currency over the live ones only: a deleted match is listed, struck, and never added up.
 */
const ME = `${DEMO_LARGE_PREFIX}me`
const plan = generateLargeDemo({me: ME, today: localToday(), now: Date.now()})
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const wordsOf = (x: string) => fold(x).match(/[\p{L}\p{N}\p{M}]+/gu) ?? []

type Planned = {id: string; title: string; date: string; created: number; currency: string; total: bigint; isLive: boolean; words: string[]; groupId: string | null}

/** Every expense of the plan in its final state, deleted ones included (search lists them, struck). */
function plannedExpenses(): Planned[] {
  const live = new Set(planRecords(plan).map(r => r.id))
  const created = new Map<string, number>()
  const drafts = new Map<string, Extract<(typeof plan.ops)[number], {kind: 'expense' | 'expense.update'}>>()
  for (const op of plan.ops) {
    if (op.kind === 'expense' && !created.has(op.id)) created.set(op.id, op.at)
    if (op.kind === 'expense' || op.kind === 'expense.update') drafts.set(op.id, op)
  }
  /* A live comment's words find the expense it hangs on (F-246): the last edit of its text, none once deleted. */
  const comments = new Map<string, {target: string; body: string; isLive: boolean}>()
  for (const op of plan.ops) {
    if (op.kind === 'comment') comments.set(op.id, {target: op.input.targetId, body: op.input.body, isLive: true})
    if (op.kind === 'comment.edit') comments.get(op.id)!.body = op.body
    if (op.kind === 'comment.delete') comments.get(op.id)!.isLive = false
  }
  const commentText = (id: string) => [...comments.values()].filter(c => c.isLive && c.target === id).map(c => c.body).join(' ')
  return [...drafts].map(([id, op]) => {
    const d = op.draft
    const text = [d.title, d.notes, commentText(id), ...(d.split.mode === 'items' ? d.split.items.map(i => i.name) : [])].join(' ')
    return {id, title: d.title, date: d.date, created: created.get(id) ?? 0, currency: d.currency, total: d.total, isLive: live.has(id), words: wordsOf(text), groupId: d.groupId}
  })
}

/** The rows a query must list newest first (the day, then the later-created first) and the one-total-per-currency line over the live ones. */
function expectedMatches(match: (e: Planned) => boolean) {
  const rows = plannedExpenses()
    .filter(match)
    .sort((x, y) => (x.date === y.date ? y.created - x.created || (x.id < y.id ? -1 : 1) : x.date < y.date ? 1 : -1))
  const totals: Record<string, bigint> = {}
  for (const r of rows) if (r.isLive) totals[r.currency] = (totals[r.currency] ?? 0n) + r.total
  const line = Object.keys(totals)
    .sort()
    .map(c => formatAmount(totals[c]!, c, 'en-US'))
    .join('  ·  ')
  return {rows, line, deleted: rows.filter(r => !r.isLive).length}
}

function expectedSearch(word: string) {
  // Expenses of a group named like the word match too (a word of the group's name); a friend named like it would too, which this model does not cover: say so loudly.
  const people = plan.ops.flatMap(o => (o.kind === 'person' ? [o.name] : []))
  expect(people.filter(n => wordsOf(n).some(w => w.startsWith(word)))).toEqual([])
  const groups = new Set(plan.ops.flatMap(o => (o.kind === 'group' && wordsOf(o.input.name).some(w => w.startsWith(word)) ? [o.id] : [])))
  return expectedMatches(e => e.words.some(w => w.startsWith(word)) || (e.groupId !== null && groups.has(e.groupId)))
}

/** The i-th expense row: payments that match are listed above the expenses (F-246), so rows are counted from the Expenses heading. */
const expenseRow = (screen: Locator, i: number) => screen.getByTestId('search-section-expenses').locator('xpath=following::*[starts-with(@data-testid, "search-row-")]').nth(i)

const PHONE = {width: 390, height: 844}
const DESKTOP = {width: 1440, height: 900}

async function openSearch(page: Page) {
  await openDemo(page)
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await page.getByTestId('header-search-ask').click()
  const screen = page.getByTestId('search-ask')
  await expect(screen).toBeVisible()
  await expect(page.getByTestId('search-input')).toBeFocused()
  return screen
}

test.use({viewport: DESKTOP})

test('the header button opens the drawer; a title finds it, a note finds its expense, and totals are one per currency', async ({
  page,
}) => {
  const screen = await openSearch(page)
  // There is no Search page or nav item (26.3).
  await expect(page.getByTestId('tab-search')).toHaveCount(0)
  await expect(page.getByTestId('screen-search')).toHaveCount(0)

  // A title that only the curated story has.
  await page.getByTestId('search-input').fill('thalassa')
  const expenses = screen.getByTestId('search-section-expenses')
  await expect(expenses).toContainText('Expenses')
  await expect(expenses).toContainText('1')
  await expect(screen.getByTestId('search-totals')).toHaveText('₹12,500.00')
  await expect(screen.getByTestId('search-row-1')).toContainText('Dinner at Thalassa')

  // A word only in a note: "Pizza dinner at Riya’s before the film" is on Movie night.
  await page.getByTestId('search-input').fill('before the film')
  await expect(screen.getByTestId('search-row-1')).toContainText('Movie night')
  await expect(screen.getByTestId('search-totals')).toHaveText('₹900.00')

  // A word all over the year: the exact count, the newest-first order and one total per currency, computed from the plan.
  const dinner = expectedSearch('dinner')
  expect(dinner.rows.length).toBeGreaterThan(30)
  await page.getByTestId('search-input').fill('dinner')
  await expect(screen.getByTestId('search-section-expenses')).toContainText(new RegExp(`Expenses\\s+${dinner.rows.length}(?!\\d)`), {timeout: 30_000})
  // The totals arrive once every match is read; only live matches are added up.
  await expect(screen.getByTestId('search-totals')).toHaveText(dinner.line, {timeout: 30_000})
  // The expenses follow the "Ask Splito" row, the groups and any payments, newest first.
  for (const [i, r] of dinner.rows.slice(0, 8).entries()) await expect(expenseRow(screen, i)).toContainText(r.title)
})

test('a deleted match stays in the list but never in the totals', async ({page}) => {
  const screen = await openSearch(page)
  // Find a word that has both a live and a deleted expense, from the plan.
  const candidates = ['sunset', 'takeout', 'pizza', 'cruise']
  const word = candidates.find(w => {
    const e = expectedSearch(w)
    return e.deleted > 0 && e.rows.length > e.deleted
  })
  expect(word, 'the plan has a word with live and deleted matches').toBeDefined()
  const e = expectedSearch(word!)
  await page.getByTestId('search-input').fill(word!)
  await expect(screen.getByTestId('search-section-expenses')).toContainText(new RegExp(`Expenses\\s+${e.rows.length}(?!\\d)`), {timeout: 30_000})
  await expect(screen.getByTestId('search-totals')).toHaveText(e.line, {timeout: 30_000})
})

test('amount and date queries', async ({page}) => {
  const screen = await openSearch(page)
  const count = (n: number) => new RegExp(`Expenses\\s+${n}(?!\\d)`)
  const unit = (currency: string) => 10n ** BigInt(getCurrency(currency).scale)

  // Over 1000 in the major units of its own currency (yen has no minor unit, dinar has three); deleted ones are listed too.
  const over = expectedMatches(e => e.total > 1000n * unit(e.currency))
  await page.getByTestId('search-input').fill('> 1000')
  await expect(screen.getByTestId('search-section-expenses')).toContainText(count(over.rows.length), {timeout: 30_000})
  await expect(screen.getByTestId('search-totals')).toHaveText(over.line, {timeout: 30_000})
  await expect(expenseRow(screen, 0)).toContainText(over.rows[0]!.title)

  // An exact amount (or a word that starts with it): every expense of exactly 4500 in its own currency.
  const exact = expectedMatches(e => e.total === 4500n * unit(e.currency) || e.words.some(w => w.startsWith('4500')))
  expect(exact.rows.length).toBeGreaterThan(0)
  await page.getByTestId('search-input').fill('4500')
  await expect(screen.getByTestId('search-section-expenses')).toContainText(count(exact.rows.length), {timeout: 30_000})
  await expect(expenseRow(screen, 0)).toContainText(exact.rows[0]!.title)
  await expect(expenseRow(screen, exact.rows.length)).toHaveCount(0)

  // A month by name, in any year, newest first.
  const march = expectedMatches(e => e.date.slice(5, 7) === '03' || e.words.some(w => w.startsWith('march')))
  await page.getByTestId('search-input').fill('march')
  await expect(screen.getByTestId('search-section-expenses')).toContainText(count(march.rows.length), {timeout: 30_000})
  for (const [i, r] of march.rows.slice(0, 5).entries()) await expect(expenseRow(screen, i)).toContainText(r.title)

  await page.getByTestId('search-input').fill('zzzz')
  await expect(screen.getByTestId('search-empty')).toContainText(
    'No results found for “zzzz”.',
  )
})

test('arrow keys move through results and Enter opens one; people and groups come first', async ({
  page,
}) => {
  const screen = await openSearch(page)
  const input = page.getByTestId('search-input')
  await input.fill('sam')
  await expect(screen.getByTestId('search-section-people')).toBeVisible()
  await expect(screen.getByTestId('search-row-1')).toContainText('Sam Carter')
  await input.press('ArrowDown')
  await input.press('ArrowDown')
  await expect(screen.getByTestId('search-row-1')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  // The Ask Splito row is the first stop of the keyboard.
  await input.press('ArrowUp')
  await expect(screen.getByTestId('search-row-0')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByTestId('screen-person')).toBeVisible()
  await expect(page).toHaveURL(/\/people\//)
})

test('recent searches: kept on submit, reopened with a tap, cleared behind a prompt', async ({
  page,
}) => {
  const screen = await openSearch(page)
  await expect(screen.getByTestId('search-tips')).toBeVisible()
  const input = page.getByTestId('search-input')
  await input.fill('dinner')
  await input.press('Enter')
  await input.fill('goa')
  await input.press('Enter')
  await input.fill('')

  await expect(screen.getByTestId('search-recent-goa')).toBeVisible()
  await screen.getByTestId('search-recent-dinner').click()
  await expect(input).toHaveValue('dinner')
  await expect(screen.getByTestId('search-section-expenses')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('search-ask')).toHaveCount(0)
  await page.getByTestId('header-search-ask').click()
  await expect(page.getByTestId('search-recent-dinner')).toBeVisible()
  await page.getByTestId('searchHistoryClearAllBtn').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('search-recent-dinner')).toHaveCount(0)
  await expect(page.getByTestId('search-tips')).toBeVisible()
})

test('Ctrl+K toggles the drawer from anywhere and "/" opens it; the button tooltip and input show the hint', async ({
  page,
}) => {
  // The button is on the start tab (People) only (owner 218); the shortcut works from any page.
  await openDemo(page, '/people')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  const button = page.getByTestId('screen-people').getByTestId('header-search-ask')
  await expect(button).toBeVisible()
  await expect(button.locator('xpath=ancestor::*[@title][1]')).toHaveAttribute(
    'title',
    /Search or ask Splito \((⌘K|Ctrl K)\)/,
  )
  await openDemo(page, '/groups')
  await expect(page.getByTestId('screen-groups')).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('search-ask')).toBeVisible()
  await expect(page.getByTestId('search-ask-shortcut')).toHaveText(/⌘K|Ctrl K/)
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('search-ask')).toHaveCount(0)
  await page.keyboard.press('/')
  await expect(page.getByTestId('search-input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('search-ask')).toHaveCount(0)
})

test('/search opens the drawer with the query; tapping a result opens it and closes the drawer', async ({
  page,
}) => {
  await openDemo(page, '/search?q=goa')
  await expect(page.getByTestId('search-input')).toHaveValue('goa')
  await page.getByTestId('search-row-1').click()
  await expect(page.getByTestId('search-ask')).toHaveCount(0)
  await expect(page.getByTestId('screen-group')).toBeVisible()
})

test.describe('phone', () => {
  test.use({viewport: PHONE})

  test('the start tab\'s header has the button left of its action, no other tab has it; it opens the full-height drawer', async ({
    page,
  }) => {
    await openDemo(page)
    await expect(page.getByTestId('screen-people')).toBeVisible()
    for (const [path, screen] of [
      ['/groups', 'screen-groups'],
      ['/analytics', 'screen-analytics'],
      ['/activity', 'screen-activity'],
    ] as const) {
      await openDemo(page, path)
      await expect(page.getByTestId(screen)).toBeVisible()
      await expect(page.getByTestId(screen).getByTestId('header-search-ask')).toHaveCount(0)
    }
    for (const [path, screen, action] of [['/people', 'screen-people', 'people-add-friend']] as const) {
      await openDemo(page, path)
      const button = page.getByTestId(screen).getByTestId('header-search-ask')
      await expect(button).toBeVisible()
      await expect(button).toHaveAttribute('aria-label', 'Search or ask Splito')
      const b = (await button.boundingBox())!
      const act = (await page
        .getByTestId(screen)
        .getByTestId(action)
        .boundingBox())!
      expect(b.x + b.width).toBeLessThanOrEqual(act.x + 1)
    }
    await openDemo(page)
    await page.getByTestId('header-search-ask').click()
    const sheet = page.getByTestId('search-ask')
    await expect(sheet).toBeVisible()
    await page.getByTestId('search-input').fill('goa')
    await expect(sheet.getByTestId('search-section-groups')).toBeVisible()
    await page.getByTestId('search-ask-cancel').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('screen-people')).toBeVisible()
  })
})

test.describe('a broad query pages: the first page, the count and totals at once, more by cursor', () => {
  test('600 matches show 30 rows with the real count and totals, and Show more adds a page', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForFunction(() => 'splito' in window)
    await page.evaluate(() =>
      (
        window as unknown as {
          splito: {
            seedBulk(i: {
              friends: number
              groups: number
              expenses: number
            }): Promise<number>
          }
        }
      ).splito.seedBulk({friends: 20, groups: 5, expenses: 600}),
    )
    await page.reload()
    await page.getByTestId('header-search-ask').last().click()
    const screen = page.getByTestId('search-ask')
    await expect(screen).toBeVisible()
    await page.getByTestId('search-input').fill('bulk')
    // The first page: 30 expenses (and the people and groups), however many match, with the count and totals already there.
    await expect(screen.getByTestId('search-row-0')).toBeVisible()
    const rows = screen.locator('[data-testid^="search-row-"]')
    const shown = await screen.locator('[data-testid^="search-row-"]').count()
    expect(shown).toBeLessThan(80)
    await expect(screen.getByTestId('search-show-more')).toBeVisible()
    await expect(screen.getByTestId('search-totals')).toBeVisible()
    await expect(screen.getByTestId('search-section-expenses')).toContainText(
      '600',
    )
    const before = await rows.count()
    await screen.getByTestId('search-show-more').click()
    await expect.poll(() => rows.count()).toBeGreaterThan(before)
    // A new keystroke starts over with one page.
    await page.getByTestId('search-input').fill('bulk friend 1')
    await expect(screen.getByTestId('search-row-0')).toBeVisible()
  })
})

/*
 * F-246: facets become chips, a result names the field that matched, and the engine reads statuses, comments and
 * payments. The same searches at a phone (390) and a desktop (1440) width, with no horizontal overflow.
 */
for (const [name, viewport] of [
  ['phone 390', PHONE],
  ['desktop 1440', DESKTOP],
] as const) {
  test.describe(`search by every field (${name})`, () => {
    test.use({viewport})

    test('a facet is a removable chip; the field that matched is named and marked', async ({page}) => {
      const screen = await openSearch(page)
      const input = page.getByTestId('search-input')

      // "Dinner at Thalassa" is 12,500: over 20,000 leaves no expense, and removing the chip brings it back.
      await input.fill('thalassa over 20000')
      const chip = screen.getByTestId('search-chip-amount')
      await expect(chip).toContainText('over 20000')
      await expect(screen.getByTestId('search-section-expenses')).toHaveCount(0)
      await chip.click()
      await expect(input).toHaveValue('thalassa')
      await expect(screen.getByTestId('search-chip-amount')).toHaveCount(0)
      await expect(screen.getByTestId('search-section-expenses')).toContainText('1')
      await expect(screen.getByTestId('search-row-1')).toContainText('Dinner at Thalassa')

      // A word only in a note: the row says "Notes" and marks the words.
      await input.fill('before the film')
      const note = screen.locator('[data-testid$="-notes"]')
      await expect(note).toContainText('Notes')
      await expect(note).toContainText('Pizza dinner at Riya’s before the film')

      // A comment on the dinner finds it, and says so.
      await input.fill('sunset')
      // (The deleted "Sunset cruise" is newer and comes first; the dinner is found by its comment.)
      await expect(screen.getByText('Dinner at Thalassa').first()).toBeVisible()
      await expect(screen.locator('[data-testid$="-comment"]').first()).toContainText('Booked the table for eight')

      // An amount facet is named on the row too (the amount itself is in the right column, never printed twice).
      await input.fill('thalassa between 12000 and 13000')
      await expect(screen.getByTestId('search-chip-amount')).toBeVisible()
      const amount = screen.locator('[data-testid^="search-match-"][data-testid$="-amount"]').first()
      await expect(amount).toHaveText('Amount')
      await expect(expenseRow(screen, 0)).toContainText('₹12,500.00')

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })

    test('status and type words: deleted, payments, and a comment on a payment', async ({page}) => {
      const screen = await openSearch(page)
      const input = page.getByTestId('search-input')

      // The deleted duplicate is listed, struck, found by "deleted" and a word of its title; the chip says Status.
      await input.fill('deleted scooter')
      await expect(screen.getByTestId('search-chip-status')).toContainText('deleted')
      await expect(screen.getByTestId('search-row-1')).toContainText('Scooter rentals (duplicate)')
      await expect(screen.locator('[data-testid^="search-deleted-"]').first()).toBeVisible()

      // A payment is found through its comment, under its own heading.
      await input.fill('payments sent')
      await expect(screen.getByTestId('search-chip-type')).toBeVisible()
      await expect(screen.getByTestId('search-section-payments')).toBeVisible()
      await expect(screen.locator('[data-testid$="-comment"]').first()).toContainText('Sent!')
      await expect(screen.getByTestId('search-section-expenses')).toHaveCount(0)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
}

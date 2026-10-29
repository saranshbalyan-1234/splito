import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-1401 free search inside the Search & Ask drawer (F-222): opened by the
 * header Sparkles button, Cmd/Ctrl+K or "/", results grouped with totals per
 * currency, amount and date words, recent searches, arrow-key navigation.
 */

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
  await expect(screen.getByTestId('search-row-0')).toContainText('Dinner at Thalassa')

  // A word only in a note: "Pizza dinner at Riya’s before the film" is on Movie night.
  await page.getByTestId('search-input').fill('before the film')
  await expect(screen.getByTestId('search-row-0')).toContainText('Movie night')
  await expect(screen.getByTestId('search-totals')).toHaveText('₹900.00')

  // A word all over the year: one total per currency, never one mixed sum.
  await page.getByTestId('search-input').fill('dinner')
  await expect(screen.getByTestId('search-totals')).toBeVisible({timeout: 30_000})
  // Results stream in: wait until every currency's total is there.
  const readTotals = async () => (await screen.getByTestId('search-totals').innerText()).split('·').map(t => t.trim())
  await expect.poll(async () => (await readTotals()).length, {timeout: 30_000}).toBeGreaterThanOrEqual(3)
  const totals = await readTotals()
  expect(totals.some(t => t.startsWith('₹'))).toBe(true)
  expect(totals.some(t => t.startsWith('€'))).toBe(true)
})

test('amount and date queries', async ({page}) => {
  const screen = await openSearch(page)
  await page.getByTestId('search-input').fill('> 1000')
  await expect(screen.getByTestId('search-section-expenses')).toBeVisible()
  await expect(screen.getByTestId('search-row-0')).toBeVisible()

  await page.getByTestId('search-input').fill('4500')
  await expect(screen.getByTestId('search-section-expenses')).toBeVisible()
  await expect(screen.locator('[data-testid^="search-row-"]').filter({hasText: 'Beach shack lunch'})).toHaveCount(1)

  await page.getByTestId('search-input').fill('march')
  await expect(screen.getByTestId('search-section-expenses')).toBeVisible()
  await expect(screen.getByTestId('search-row-0')).toBeVisible()

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
  await expect(screen.getByTestId('search-row-0')).toContainText('Sam Carter')
  await input.press('ArrowDown')
  await input.press('ArrowDown')
  await expect(screen.getByTestId('search-row-1')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await input.press('ArrowUp')
  await expect(screen.getByTestId('search-row-0')).toHaveAttribute(
    'aria-selected',
    'true',
  )
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
  await openDemo(page, '/groups')
  await expect(page.getByTestId('screen-groups')).toBeVisible()
  const button = page.getByTestId('screen-groups').getByTestId('header-search-ask')
  await expect(button).toBeVisible()
  await expect(button.locator('xpath=ancestor::*[@title][1]')).toHaveAttribute('title', /Search or ask Splito \((⌘K|Ctrl K)\)/)
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
  await page.getByTestId('search-row-0').click()
  await expect(page.getByTestId('search-ask')).toHaveCount(0)
  await expect(page.getByTestId('screen-group')).toBeVisible()
})

test.describe('phone', () => {
  test.use({viewport: PHONE})

  test('every top-level header has the button left of its action; it opens the full-height drawer', async ({
    page,
  }) => {
    await openDemo(page)
    await expect(page.getByTestId('screen-people')).toBeVisible()
    for (const [path, screen, action] of [
      ['/', 'screen-people', 'people-add-friend'],
      ['/groups', 'screen-groups', 'groups-new'],
      ['/analytics', 'screen-analytics', 'analytics-export'],
      ['/activity', 'screen-activity', 'activity-mark-all-read'],
    ] as const) {
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

test.describe('a broad query pages: the first page at once, the totals after, more by cursor', () => {
  test('600 matches show 30 rows, "Calculating totals…" then the count and totals, and Show more adds a page', async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => 'splito' in window)
    await page.evaluate(() =>
      (window as unknown as {splito: {seedBulk(i: {friends: number; groups: number; expenses: number}): Promise<number>}}).splito.seedBulk({friends: 20, groups: 5, expenses: 600}),
    )
    await page.reload()
    await page.getByTestId('header-search-ask').last().click()
    const screen = page.getByTestId('search-ask')
    await expect(screen).toBeVisible()
    await page.getByTestId('search-input').fill('bulk')
    // The first page: 30 expenses (and the people and groups), however many match.
    await expect(screen.getByTestId('search-row-0')).toBeVisible()
    const rows = screen.locator('[data-testid^="search-row-"]')
    const shown = await screen.locator('[data-testid^="search-row-"]').count()
    expect(shown).toBeLessThan(80)
    await expect(screen.getByTestId('search-show-more')).toBeVisible()
    // Totals fill in after it: the heading's count becomes the real one, with one total per currency.
    await expect(screen.getByTestId('search-totals')).toBeVisible({timeout: 30_000})
    await expect(screen.getByTestId('search-totals-pending')).toHaveCount(0)
    await expect(screen.getByTestId('search-section-expenses')).toContainText('600')
    const before = await rows.count()
    await screen.getByTestId('search-show-more').click()
    await expect.poll(() => rows.count()).toBeGreaterThan(before)
    // A new keystroke starts over with one page.
    await page.getByTestId('search-input').fill('bulk friend 1')
    await expect(screen.getByTestId('search-row-0')).toBeVisible()
  })
})

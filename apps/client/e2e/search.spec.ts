import {expect, type Page, test} from '@playwright/test'

import {DEMO_EXPENSES} from '../src/data/demoData'

/*
 * F-1401 free search: reached from the sidebar and the drawer, results
 * grouped with totals per currency, amount and date words, recent searches,
 * and arrow-key navigation on web.
 */

const PHONE = {width: 390, height: 844}
const DESKTOP = {width: 1440, height: 900}

async function openSearch(page: Page) {
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  await page.getByTestId('tab-search').click()
  const screen = page.getByTestId('screen-search')
  await expect(screen).toBeVisible()
  await expect(page.getByTestId('search-input')).toBeFocused()
  return screen
}

test.use({viewport: DESKTOP})

test('the sidebar opens Search; "dinner" finds titles and notes, with one total per currency', async ({
  page,
}) => {
  const screen = await openSearch(page)
  await expect(page).toHaveURL(/\/search/)
  await expect(page.getByTestId('tab-search')).toHaveAttribute(
    'aria-current',
    'page',
  )

  await page.getByTestId('search-input').fill('dinner')
  const expenses = screen.getByTestId('search-section-expenses')
  await expect(expenses).toContainText('Expenses')
  await expect(expenses).toContainText('4')
  // Dinner at Thalassa and Movie night in rupees; Seafood at Ramiro and Fado night in euros. Never one mixed sum.
  await expect(screen.getByTestId('search-totals')).toHaveText(
    '€344.00  ·  ₹13,400.00',
  )
  await expect(screen.getByTestId('search-row-0')).toContainText('Movie night')
  await expect(screen.getByTestId('search-row-0')).toContainText('Pizza dinner')
  await expect(screen.getByTestId('search-row-3')).toContainText(
    'Dinner at Thalassa',
  )
})

test('amount and date queries', async ({page}) => {
  const screen = await openSearch(page)
  const over1000 = DEMO_EXPENSES.filter(e => e.total > 100000n).length
  await page.getByTestId('search-input').fill('> 1000')
  await expect(screen.getByTestId('search-section-expenses')).toContainText(
    String(over1000),
  )
  await expect(screen.getByTestId(`search-row-${over1000 - 1}`)).toBeVisible()
  await expect(screen.getByTestId(`search-row-${over1000}`)).toHaveCount(0)

  await page.getByTestId('search-input').fill('4500')
  await expect(screen.getByTestId('search-row-0')).toContainText(
    'Beach shack lunch',
  )
  await expect(screen.getByTestId('search-row-1')).toHaveCount(0)

  await page.getByTestId('search-input').fill('march')
  await expect(screen.getByTestId('search-row-0')).toContainText(
    'Concert tickets',
  )

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
  await expect(page).toHaveURL(/q=dinner/)
  await input.fill('goa')
  await input.press('Enter')
  await input.fill('')

  await expect(screen.getByTestId('search-recent-goa')).toBeVisible()
  await screen.getByTestId('search-recent-dinner').click()
  await expect(input).toHaveValue('dinner')
  await expect(screen.getByTestId('search-section-expenses')).toBeVisible()

  await page.goto('/search')
  await expect(page.getByTestId('search-recent-dinner')).toBeVisible()
  await page.getByTestId('searchHistoryClearAllBtn').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('search-recent-dinner')).toHaveCount(0)
  await expect(page.getByTestId('search-tips')).toBeVisible()
})

test.describe('phone', () => {
  test.use({viewport: PHONE})

  test('the drawer opens Search, and Back returns', async ({page}) => {
    await page.goto('/?demo=1')
    await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
    await page.getByTestId('screen-people').getByTestId('header-avatar').click()
    await page.getByTestId('drawer-search').click()
    const screen = page.getByTestId('screen-search')
    await expect(screen).toBeVisible()
    await page.getByTestId('search-input').fill('goa')
    await expect(screen.getByTestId('search-section-groups')).toBeVisible()
    await screen.getByTestId('header-back').click()
    await expect(page.getByTestId('screen-people')).toBeVisible()
  })
})

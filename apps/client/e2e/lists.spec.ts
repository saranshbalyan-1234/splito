import {expect, type Page, test} from '@playwright/test'

import {openDemo as enterDemo, showSettled} from './openDemo'

/*
 * Owner rules 8 and 9 on the two list screens: Overview, the search icon
 * that grows into a field, the filters sheet (Apply / Cancel / dot), the
 * Include groups switch driving the totals, and the bottom inset that keeps
 * the FAB off the last row on phones.
 */

const PHONE = {width: 390, height: 844}

type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
}

/** A04: Kavya owes me 100 directly and 50 in a shared group. */
async function seedA04(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const kavya = await s.createPerson('Kavya Rao')
    const group = await s.createGroup({
      name: 'Pune trip',
      kind: 'trip',
      currency: 'INR',
      startDate: null,
      endDate: null,
      memberIds: [kavya],
    })
    const base = {
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
    }
    await s.createExpense({
      ...base,
      title: 'Concert',
      groupId: null,
      total: '20000',
      payers: {[s.me]: '20000'},
      split: {mode: 'equal', participants: [s.me, kavya]},
      date: '2026-10-20',
    })
    await s.createExpense({
      ...base,
      title: 'Snacks',
      groupId: group,
      total: '10000',
      payers: {[s.me]: '10000'},
      split: {mode: 'equal', participants: [s.me, kavya]},
      date: '2026-10-21',
    })
  })
}

test('A04: Include groups reads 150 with groups and 100 without on People; the Overview at the top of Analytics counts everything (scope All)', async ({
  page,
}) => {
  await seedA04(page)
  await page.goto('/analytics')
  await expect(page.getByTestId('screen-analytics').getByTestId('summary-INR-net')).toHaveText('₹150.00')
  await page.goto('/people')
  const people = page.getByTestId('screen-people')
  await expect(
    people.getByTestId('person-Kavya Rao').getByTestId('balance-INR'),
  ).toHaveText('owes you ↙ ₹150.00')

  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-include-groups').click()
  await page.getByTestId('sheet-save').click()
  await expect(
    people.getByTestId('person-Kavya Rao').getByTestId('balance-INR'),
  ).toHaveText('owes you ↙ ₹100.00')
  await expect(people.getByTestId('list-filters-dot')).toBeVisible()
  // People's Overview counts as its list does (owner 219): Include groups off, the non-group balance only.
  await expect(people.getByTestId('people-overview').getByTestId('summary-INR-net')).toHaveText('₹100.00')
  // Analytics keeps its own scope (Everything), whatever the friends filter says.
  await page.getByTestId('tab-analytics').click()
  await expect(page.getByTestId('screen-analytics').getByTestId('summary-INR-net')).toHaveText('₹150.00')

  // Back on: the defaults again, so the dot goes.
  await page.getByTestId('tab-people').click()
  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-include-groups').click()
  await page.getByTestId('sheet-save').click()
  await expect(people.getByTestId('list-filters-dot')).toHaveCount(0)
})

test('search grows from the icon to the row width, Escape folds it, and it combines with filters', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await enterDemo(page, '/groups')
  await showSettled(page)
  await page.reload()
  const groups = page.getByTestId('screen-groups')
  await expect(groups.locator('[data-testid^="group-"][href]').first()).toBeVisible()
  const icon = (await groups.getByTestId('list-search').boundingBox())!
  await groups.getByTestId('list-search').click()
  const field = groups.getByTestId('list-search-input')
  await expect(field).toBeFocused()
  // Fully open, the field spans the row (16px gutters) up to the Filters button, which stays beside it.
  await expect
    .poll(async () => (await field.boundingBox())!.width)
    .toBeGreaterThan(PHONE.width - 32 - 40 - 40 - 80) // the Sort button sits beside Filters now (owner 199)
  expect(icon.width).toBeLessThan(60)
  await expect(groups.getByTestId('list-filters')).toBeVisible()
  await field.fill('lena')
  await expect(groups.getByTestId('list-search-count')).toHaveText('1 of 18')

  await field.press('Escape')
  await expect(field).toHaveCount(0)

  // Filters and search combine: only the Home-kind groups, then "flat" among them.
  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-type-home').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('group-Lisbon')).toHaveCount(0)
  await groups.getByTestId('list-search').click()
  await groups.getByTestId('list-search-input').fill('flat')
  await expect(groups.getByTestId('group-Flat 4B')).toBeVisible()
  await expect(groups.getByTestId('list-filters-dot')).toHaveCount(1)

  await groups.getByTestId('list-search-input').press('Escape')
  await expect(groups.getByTestId('list-search-input')).toHaveCount(0)
  await expect(groups.getByTestId('list-search')).toBeVisible()
})

test('Groups: Cancel leaves the filters as they were; Sort is its own button, not a filter (owner 199)', async ({
  page,
}) => {
  await enterDemo(page, '/groups')
  const groups = page.getByTestId('screen-groups')
  const rows = groups.locator('[data-testid^="group-"][href]')
  await expect(rows.first()).toBeVisible()

  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-type-home').click()
  await page.getByTestId('sheet-cancel').click()
  await page.getByTestId('confirmBtn').click()
  await expect(rows.first()).toBeVisible()
  // Cancelled: the groups that are not Home-kind groups are still listed.
  await expect(groups.getByTestId('list-filters-dot')).toHaveCount(0)
  await expect(groups.getByTestId('list-filters-dot')).toHaveCount(0)

  await groups.getByTestId('list-sort').click()
  await page.getByTestId('list-sort-name').click()
  // The order is in the address and tints Sort; it is not a filter, so the Filters dot stays off.
  await expect(page).toHaveURL(/\/groups\?sort=name$/)
  await expect(groups.getByTestId('list-filters-dot')).toHaveCount(0)
  // Name order (settled groups are hidden by default, F-1413).
  const names = (await groups
    .locator('[data-testid^="group-"][href]')
    .evaluateAll(els => els.map(e => e.getAttribute('data-testid')!)))
  expect(names.length).toBeGreaterThan(3)
  expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y)))
})

for (const [name, path, screen] of [
  ['People', '/people', 'screen-people'],
  ['Groups', '/groups', 'screen-groups'],
  ['Activity', '/activity', 'screen-activity'],
] as const) {
  test(`${name}: scrolled to the end on a phone, the FAB never covers the last row`, async ({
    page,
  }) => {
    await page.setViewportSize({width: 390, height: 600})
    if (name === 'Activity') {
      // A year of demo activity is ~50 pages: this one scrolls to the end of a short feed of the person's own.
      await page.goto('/')
      await page.waitForFunction(() => 'splito' in window)
      await page.evaluate(async () => {
        const s = (window as unknown as {splito: {me: string; createPerson(n: string): Promise<string>; createExpense(d: unknown): Promise<string>}}).splito
        const friend = await s.createPerson('Kavya')
        for (let i = 0; i < 40; i++)
          await s.createExpense({title: `Expense ${i}`, groupId: null, currency: 'INR', total: '10000', payers: {[s.me]: '10000'}, split: {mode: 'equal', participants: [s.me, friend]}, date: '2026-10-20', tz: 'Asia/Kolkata', category: 'food', notes: ''})
      })
      await page.goto(path)
    } else await enterDemo(page, path)
    const inset = page.getByTestId(screen).getByTestId('fab-inset')
    await expect(inset).toHaveCount(1)
    await page.mouse.move(PHONE.width / 2, 300)
    // Long lists load a page at a time: scroll until no more rows come in.
    let lastY = -1
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 20000)
      await page.waitForTimeout(400)
      const y = (await inset.boundingBox())!.y
      if (y === lastY) break
      lastY = y
    }
    // The inset starts where the last row ends.
    const lastRowBottom = (await inset.boundingBox())!.y
    const fab = (await page
      .getByTestId(screen)
      .getByTestId('fab-add')
      .boundingBox())!
    expect(lastRowBottom).toBeLessThanOrEqual(fab.y - 8)
  })
}

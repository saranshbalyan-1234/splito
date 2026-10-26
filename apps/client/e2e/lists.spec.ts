import {expect, type Page, test} from '@playwright/test'

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

async function openDemo(page: Page) {
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
}

/** A04: Kavya owes me 100 directly and 50 in a shared group. */
async function seedA04(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const kavya = await s.createPerson('Kavya Rao')
    const group = await s.createGroup({name: 'Pune trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [kavya]})
    const base = {currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: ''}
    await s.createExpense({...base, title: 'Concert', groupId: null, total: '20000', payers: {[s.me]: '20000'}, split: {mode: 'equal', participants: [s.me, kavya]}, date: '2026-10-20'})
    await s.createExpense({...base, title: 'Snacks', groupId: group, total: '10000', payers: {[s.me]: '10000'}, split: {mode: 'equal', participants: [s.me, kavya]}, date: '2026-10-21'})
  })
}

test('A04 on People: the Overview reads 150 with groups and 100 without, the row follows', async ({page}) => {
  await seedA04(page)
  await page.goto('/')
  const people = page.getByTestId('screen-people')
  await expect(people.getByTestId('summary-INR-net')).toHaveText('₹150.00')
  await expect(people.getByTestId('person-Kavya Rao').getByTestId('balance-INR')).toHaveText('owes you ₹150.00')

  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-include-groups').click()
  await page.getByTestId('sheet-save').click()
  await expect(people.getByTestId('summary-INR-net')).toHaveText('₹100.00')
  await expect(people.getByTestId('person-Kavya Rao').getByTestId('balance-INR')).toHaveText('owes you ₹100.00')
  await expect(people.getByTestId('list-filters-dot')).toBeVisible()

  // Back on: the defaults again, so the dot goes.
  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-include-groups').click()
  await page.getByTestId('sheet-save').click()
  await expect(people.getByTestId('summary-INR-net')).toHaveText('₹150.00')
  await expect(people.getByTestId('list-filters-dot')).toHaveCount(0)
})

test('search grows from the icon to the row width, Escape folds it, and it combines with filters', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  const people = page.getByTestId('screen-people')
  const icon = (await people.getByTestId('list-search').boundingBox())!
  await people.getByTestId('list-search').click()
  const field = people.getByTestId('list-search-input')
  await expect(field).toBeFocused()
  // Fully open, the field spans the row (16px gutters), well past the icon it grew from.
  await expect
    .poll(async () => (await field.boundingBox())!.width)
    .toBeGreaterThan(PHONE.width - 32 - 80)
  expect(icon.width).toBeLessThan(60)

  await field.press('Escape')
  await expect(field).toHaveCount(0)

  // Filters and search combine: only who I owe, then "a" among them.
  await people.getByTestId('list-filters').click()
  await page.getByTestId('filter-show-youOwe').click()
  await page.getByTestId('sheet-save').click()
  await expect(people.getByTestId('person-Arjun Mehta')).toHaveCount(0)
  await people.getByTestId('list-search').click()
  await people.getByTestId('list-search-input').fill('lena')
  await expect(people.getByTestId('person-Lena Fischer')).toBeVisible()
  await expect(people.getByTestId('person-Sam Carter')).toHaveCount(0)
  await expect(people.getByTestId('list-filters-dot')).toHaveCount(1)

  await people.getByTestId('list-search-input').press('Escape')
  await expect(people.getByTestId('list-search-input')).toHaveCount(0)
  await expect(people.getByTestId('list-search')).toBeVisible()
})

test('Groups: Cancel leaves the filters as they were; Apply sets the dot', async ({page}) => {
  await openDemo(page)
  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()

  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-type-home').click()
  await page.getByTestId('sheet-cancel').click()
  await page.getByTestId('confirmBtn').click()
  await expect(groups.getByTestId('group-Lisbon')).toBeVisible()
  await expect(groups.getByTestId('list-filters-dot')).toHaveCount(0)

  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-sort-name').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('list-filters-dot')).toBeVisible()
  // Name order: Flat 4B, Goa trip, Lisbon.
  const names = await groups.locator('[data-testid^="group-"][href]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(names).toEqual(['group-Flat 4B', 'group-Goa trip', 'group-Lisbon'])
})

for (const [name, path, screen] of [
  ['People', '/', 'screen-people'],
  ['Groups', '/groups', 'screen-groups'],
  ['Activity', '/activity', 'screen-activity'],
] as const) {
  test(`${name}: scrolled to the end on a phone, the FAB never covers the last row`, async ({page}) => {
    await page.setViewportSize({width: 390, height: 600})
    await openDemo(page)
    await page.goto(path)
    const inset = page.getByTestId(screen).getByTestId('fab-inset')
    await expect(inset).toHaveCount(1)
    await page.mouse.move(PHONE.width / 2, 300)
    await page.mouse.wheel(0, 20000)
    await page.waitForTimeout(400)
    // The inset starts where the last row ends.
    const lastRowBottom = (await inset.boundingBox())!.y
    const fab = (await page.getByTestId(screen).getByTestId('fab-add').boundingBox())!
    expect(lastRowBottom).toBeLessThanOrEqual(fab.y - 8)
  })
}

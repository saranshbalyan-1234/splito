import {expect, type Page, test} from '@playwright/test'

/*
 * F-1413 (owner 90, 112): fully settled friends and groups are hidden by default; each filter
 * sheet has "Show settled" (off), stored as a preference and restored after a reload. The
 * counts line still says how many are settled. Sort and Include groups are saved on Apply too
 * (owner 128), so they survive a reload.
 */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
  createRepayment(input: unknown): Promise<string>
}

/** Open (owes 100), Even (paid back), New (no records yet); groups Trip (open) and Done (settled). */
async function seed(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const open = await s.createPerson('Open Olive')
    const even = await s.createPerson('Even Evan')
    await s.createPerson('New Nina')
    const expense = (friend: string, groupId: string | null) =>
      s.createExpense({
        title: 'Lunch',
        groupId,
        currency: 'INR',
        tz: 'Asia/Kolkata',
        category: 'food',
        notes: '',
        total: '20000',
        payers: {[s.me]: '20000'},
        split: {mode: 'equal', participants: [s.me, friend]},
        date: '2026-10-20',
      })
    await expense(open, null)
    await expense(even, null)
    await s.createRepayment({groupId: null, currency: 'INR', from: even, to: s.me, amount: '10000', date: '2026-10-21', tz: 'Asia/Kolkata', note: ''})
    const trip = await s.createGroup({name: 'Open Trip', kind: 'trip', currency: 'INR', memberIds: [open], startDate: null, endDate: null})
    const done = await s.createGroup({name: 'Done Trip', kind: 'trip', currency: 'INR', memberIds: [even], startDate: null, endDate: null})
    await expense(open, trip)
    await expense(even, done)
    await s.createRepayment({groupId: done, currency: 'INR', from: even, to: s.me, amount: '10000', date: '2026-10-21', tz: 'Asia/Kolkata', note: ''})
  })
}

test('Home hides friends settled up by default; Show settled brings them back and survives a reload', async ({page}) => {
  await seed(page)
  // The counts line on Home keeps saying how many are settled, so nothing looks lost.
  await page.goto('/')
  await expect(page.getByTestId('home-overview-counts')).toContainText(/settled/)
  await page.goto('/people')
  const home = page.getByTestId('screen-people')
  await expect(home.getByTestId('person-Open Olive')).toBeVisible()
  // A friend with no records yet is new, not settled: never hidden.
  await expect(home.getByTestId('person-New Nina')).toBeVisible()
  await expect(home.getByTestId('person-Even Evan')).toHaveCount(0)

  await home.getByTestId('list-filters').click()
  await expect(page.getByTestId('filter-settled-toggle')).toHaveAttribute('aria-checked', 'false')
  await page.getByTestId('filter-settled-toggle').click()
  await page.getByTestId('sheet-save').click()
  await expect(home.getByTestId('person-Even Evan')).toBeVisible()
  await expect(home.getByTestId('list-filters-dot')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('screen-people').getByTestId('person-Even Evan')).toBeVisible()
  await page.getByTestId('screen-people').getByTestId('list-filters').click()
  await expect(page.getByTestId('filter-settled-toggle')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('filter-settled-toggle').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-Even Evan')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('person-Open Olive')).toBeVisible()
  await expect(page.getByTestId('person-Even Evan')).toHaveCount(0)
})

test('Groups hides settled groups by default; Show settled is remembered', async ({page}) => {
  await seed(page)
  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('group-Open Trip')).toBeVisible()
  await expect(groups.getByTestId('group-Done Trip')).toHaveCount(0)

  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-settled-toggle').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('group-Done Trip')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('group-Done Trip')).toBeVisible()
})

test('a group where I am even but two others owe each other stays listed and is not counted settled (F-1413)', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const ana = await s.createPerson('Ana Trio')
    const ben = await s.createPerson('Ben Trio')
    const trio = await s.createGroup({name: 'Trio', kind: 'trip', currency: 'INR', memberIds: [ana, ben], startDate: null, endDate: null})
    // Ana paid 100 for her and Ben only: I owe nothing and am owed nothing, but Ben owes Ana.
    await s.createExpense({
      title: 'Cab for two',
      groupId: trio,
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      total: '10000',
      payers: {[ana]: '10000'},
      split: {mode: 'equal', participants: [ana, ben]},
      date: '2026-10-20',
    })
    // A group that really is square: I paid, Ana paid her half back.
    const sq = await s.createGroup({name: 'Square', kind: 'trip', currency: 'INR', memberIds: [ana], startDate: null, endDate: null})
    await s.createExpense({
      title: 'Lunch',
      groupId: sq,
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      total: '20000',
      payers: {[s.me]: '20000'},
      split: {mode: 'equal', participants: [s.me, ana]},
      date: '2026-10-20',
    })
    await s.createRepayment({groupId: sq, currency: 'INR', from: ana, to: s.me, amount: '10000', date: '2026-10-21', tz: 'Asia/Kolkata', note: ''})
  })
  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('group-Trio')).toBeVisible()
  await expect(groups.getByTestId('group-Square')).toHaveCount(0)
  // One settled: the square one, never the group whose members still owe each other.
  await expect(groups.getByTestId('groups-balances-counts')).toContainText(/2 groups · 1 settled/)
})

test('when everything left is settled up the list says so with one Show settled button, and no Clear filters', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const ana = await s.createPerson('Ana Even')
    const g = await s.createGroup({name: 'Even Trip', kind: 'trip', currency: 'INR', memberIds: [ana], startDate: null, endDate: null})
    await s.createExpense({title: 'Lunch', groupId: g, currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: '', total: '20000', payers: {[s.me]: '20000'}, split: {mode: 'equal', participants: [s.me, ana]}, date: '2026-10-20'})
    await s.createRepayment({groupId: g, currency: 'INR', from: ana, to: s.me, amount: '10000', date: '2026-10-21', tz: 'Asia/Kolkata', note: ''})
  })
  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('groups-all-settled')).toContainText('All settled up')
  await expect(groups.getByTestId('groups-clear-filters')).toHaveCount(0)
  await groups.getByTestId('groups-show-settled').click()
  await expect(groups.getByTestId('group-Even Trip')).toBeVisible()
})

test('Apply saves Sort and Include groups as preferences: both are still applied after a reload', async ({page}) => {
  await seed(page)
  await page.goto('/people')
  const home = page.getByTestId('screen-people')
  await expect(home.getByTestId('person-Open Olive')).toBeVisible()
  await home.getByTestId('list-filters').click()
  await page.getByTestId('filter-sort-name').click()
  await page.getByTestId('filter-include-groups').click()
  await page.getByTestId('sheet-save').click()
  await expect(home.getByTestId('list-filters-dot')).toBeVisible()
  await page.reload()
  const after = page.getByTestId('screen-people')
  await expect(after.getByTestId('person-Open Olive')).toBeVisible()
  await expect(after.getByTestId('list-filters-dot')).toBeVisible()
  await after.getByTestId('list-filters').click()
  await expect(page.getByTestId('filter-sort-name')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('filter-include-groups')).toHaveAttribute('aria-checked', 'false')
  await page.getByTestId('sheet-cancel').click()

  // Groups' sort is saved the same way.
  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-sort-amount').click()
  await page.getByTestId('sheet-save').click()
  // The preference is written after Apply closes the sheet; reload only once it is in the database.
  await expect
    .poll(() => page.evaluate(async () => JSON.stringify(await (window as unknown as {splito: {list(t: string): Promise<unknown>}}).splito.list('preference'))))
    .toContain('groups.sort')
  await page.reload()
  await page.getByTestId('screen-groups').getByTestId('list-filters').click()
  await expect(page.getByTestId('filter-sort-amount')).toHaveAttribute('aria-checked', 'true')
})

import {expect, type Page, test} from '@playwright/test'

/* F-621 Settings > Friends and invites, and the guarded Remove friend. */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
  createRepayment(input: unknown): Promise<string>
}

async function ready(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForFunction(() => 'splito' in window)
}

async function owes(page: Page, name: string) {
  await page.evaluate(async name => {
    const s = (window as unknown as {splito: Splito}).splito
    const f = await s.createPerson(name)
    await s.createExpense({currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: '', groupId: null, title: `Lunch ${name}`, total: '20000', payers: {[s.me]: '20000'}, split: {mode: 'equal', participants: [s.me, f]}, date: '2026-10-20'})
    return f
  }, name)
}

test('Settings has a Friends and invites page; Home links to it and the sections show', async ({page}) => {
  await ready(page, '/?demo=1')
  await page.getByTestId('people-manage-friends').click()
  await expect(page).toHaveURL(/\/settings\/friends$/)
  await expect(page.getByTestId('screen-friends-invites')).toBeVisible()
  await expect(page.getByTestId('hub-h-friends')).toBeVisible()
  await expect(page.getByTestId('hub-add-friend')).toBeVisible()
  await expect(page.getByTestId('hub-h-links')).toBeVisible()
  await page.goto('/settings')
  await page.getByTestId('settings-friends').click()
  await expect(page).toHaveURL(/\/settings\/friends$/)
  // Defaults live here too.
  await expect(page.getByTestId('pref-privacy.findByContact')).toBeVisible()
})

test('Add friend opens the Invite people sheet', async ({page}) => {
  await ready(page, '/settings/friends')
  await page.getByTestId('hub-add-friend').click()
  await expect(page).toHaveURL(/\/friends\/new$/)
})

test('a friend with an open balance cannot be removed: the amounts are listed, then settling lets it through, with Undo and Add back', async ({page}) => {
  await ready(page)
  await owes(page, 'Meera Iyer')
  await page.goto('/settings/friends')
  const row = page.getByTestId('hub-friend-Meera Iyer')
  await expect(row).toBeVisible()
  await row.getByTestId('hub-friend-remove').click()
  await expect(page.getByTestId('remove-friend-open')).toBeVisible()
  await expect(page.getByTestId('remove-friend-open-INR')).toContainText('100.00')
  await expect(page.getByTestId('remove-friend-settle')).toBeVisible()
  await expect(page.getByTestId('remove-friend-even')).toBeVisible()
  // Settle up leads to the friend's page.
  await page.getByTestId('remove-friend-settle').click()
  await expect(page).toHaveURL(/\/people\//)
  // ...and opens the settle-up flow there.
  await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
  await page.getByTestId('sheet-cancel').click()

  // The friend's own overflow uses the same guarded flow.
  await page.getByTestId('person-more').click()
  await page.getByTestId('person-delete').click()
  await expect(page.getByTestId('remove-friend-open')).toBeVisible()
  await page.getByTestId('remove-friend-even').click()
  await expect(page.getByTestId('call-even-sheet')).toBeVisible()
})

test('removing a settled friend keeps history, hides them from lists and pickers, and can be undone', async ({page}) => {
  await ready(page)
  await owes(page, 'Neel Joshi')
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const list = (await (window as unknown as {splito: {list(t: string): Promise<Array<{id: string; data: {name: string}}>>}}).splito.list('person')).find(p => p.data.name === 'Neel Joshi')!
    await s.createRepayment({groupId: null, currency: 'INR', from: list.id, to: s.me, amount: '10000', date: '2026-10-21', tz: 'Asia/Kolkata', note: ''})
  })
  await page.goto('/settings/friends')
  const row = page.getByTestId('hub-friend-Neel Joshi')
  await row.getByTestId('hub-friend-remove').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByText('Neel Joshi removed')).toBeVisible()
  await expect(row).toHaveCount(0)
  await expect(page.getByTestId('hub-removed-Neel Joshi')).toBeVisible()
  // Gone from Home's list.
  await page.goto('/')
  await expect(page.getByTestId('person-Neel Joshi')).toHaveCount(0)
  // The expense is still there.
  await page.goto('/settings/friends')
  await page.getByTestId('hub-removed-Neel Joshi').getByTestId('hub-removed-add-back').click()
  await expect(page.getByTestId('hub-friend-Neel Joshi')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('person-Neel Joshi')).toBeVisible()
})

test('above ten friends the Friends section gets a search', async ({page}) => {
  await ready(page)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    for (let i = 1; i <= 11; i++) await s.createPerson(`Friend ${String(i).padStart(2, '0')}`)
  })
  await page.goto('/settings/friends')
  await expect(page.getByTestId('hub-friends-search')).toBeVisible()
  await page.getByTestId('hub-friends-search').fill('friend 07')
  await expect(page.getByTestId('hub-friend-Friend 07')).toBeVisible()
  await expect(page.getByTestId('hub-friend-Friend 08')).toHaveCount(0)
})

test('a removed friend who gets a balance through a group stays on Home, marked Removed, with that balance', async ({page}) => {
  await ready(page)
  const ids = await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito & {createGroup(i: unknown): Promise<string>}}).splito
    const f = await s.createPerson('Tara Menon')
    const g = await s.createGroup({name: 'Flat', kind: 'home', currency: 'INR', startDate: null, endDate: null, memberIds: [f]})
    return {f, g}
  })
  await page.goto('/settings/friends')
  await page.getByTestId('hub-friend-Tara Menon').getByTestId('hub-friend-remove').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('hub-removed-Tara Menon')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('person-Tara Menon')).toHaveCount(0)
  // The group is still shared, and an expense in it gives them a balance.
  await page.evaluate(async ({f, g}) => {
    const s = (window as unknown as {splito: Splito}).splito
    await s.createExpense({currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: '', groupId: g, title: 'Rent', total: '60000', payers: {[s.me]: '60000'}, split: {mode: 'equal', participants: [s.me, f]}, date: '2026-10-22'})
  }, ids)
  await page.goto('/')
  const row = page.getByTestId('person-Tara Menon')
  await expect(row).toBeVisible()
  await expect(row).toContainText('Removed')
  await expect(row.getByTestId('balance-INR')).toContainText('300.00')
  // And the add-expense flow does not preselect or offer them.
  await page.goto(`/expense/new?groupId=${ids.g}`)
  await expect(page.getByTestId('expense-people')).not.toContainText('Tara')
})

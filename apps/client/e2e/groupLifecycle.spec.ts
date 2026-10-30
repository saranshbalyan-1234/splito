import {expect, type Page, test} from '@playwright/test'

/* F-604 archive, F-615 leave and delete group, F-613 part 1 remove member. Seeded through window.splito. */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
}

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
}

/** Rishikesh: me, Bela, Chirag. Chirag paid 300 for the three of us, so I owe Chirag 100 and Bela owes him 100. */
async function seed(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const b = await s.createPerson('Bela Joshi')
    const c = await s.createPerson('Chirag Shah')
    const group = await s.createGroup({
      name: 'Rishikesh',
      kind: 'trip',
      currency: 'INR',
      startDate: null,
      endDate: null,
      memberIds: [b, c],
    })
    await s.createExpense({
      title: 'Rafting',
      groupId: group,
      currency: 'INR',
      total: '30000',
      payers: {[c]: '30000'},
      split: {mode: 'equal', participants: [s.me, b, c]},
      date: '2026-09-05',
      tz: 'Asia/Kolkata',
      category: 'entertainment',
      notes: '',
    })
    return {group, me: s.me, b, c}
  })
}

const WIDTHS = [
  {name: 'phone', width: 390, height: 844},
  {name: 'desktop', width: 1440, height: 900},
]

for (const {name, width, height} of WIDTHS) {
  test(`${name}: inactive takes no expenses but can settle, sits in the Inactive fold, and active brings it back`, async ({page}) => {
    await page.setViewportSize({width, height})
    await ready(page)
    const {group} = await seed(page)
    await page.goto(`/groups/${group}`)
    await expect(page.getByTestId('group-add-expense')).toBeVisible()
    await page.getByTestId('group-more').click()
    await page.getByTestId('group-menu-inactive').click()
    // Money is open, so it asks first, with the amount and Settle up first.
    await expect(page.getByTestId('make-inactive-open')).toContainText('₹200.00')
    await expect(page.getByTestId('make-inactive-settle')).toBeVisible()
    await page.getByTestId('make-inactive-confirm').click()
    await expect(page.getByTestId('group-inactive-notice')).toContainText('Inactive · Make active to add expenses')
    await expect(page.getByTestId('group-add-expense')).toHaveCount(0)

    // The sync mutation refuses on its own, whatever the UI shows.
    const refusal = await page.evaluate(async id => {
      const s = (window as unknown as {splito: Splito}).splito
      try {
        await s.createExpense({title: 'Late', groupId: id, currency: 'INR', total: '100', payers: {[s.me]: '100'}, split: {mode: 'equal', participants: [s.me]}, date: '2026-09-06', tz: 'Asia/Kolkata', category: 'food', notes: ''})
        return 'allowed'
      } catch (e) {
        return String((e as Error).message)
      }
    }, group)
    expect(refusal).toContain('GROUP_INACTIVE')

    // Settling still works in an inactive group.
    await page.getByTestId('group-settle').click()
    await expect(page.getByTestId('screen-settle')).toBeVisible()

    // Out of the default list, in the Inactive (1) fold.
    await page.goto('/groups')
    const groups = page.getByTestId('screen-groups')
    await expect(groups.getByTestId('groups-inactive-fold-toggle')).toContainText('Inactive (1)')
    await expect(groups.getByTestId('group-Rishikesh')).toHaveCount(0)
    await groups.getByTestId('groups-inactive-fold-toggle').click()
    await expect(groups.getByTestId('group-Rishikesh')).toContainText('Inactive')
    // The filter reaches it too, and so does search.
    await groups.getByTestId('list-filters').click()
    await page.getByTestId('filter-status-inactive').click()
    await page.getByTestId('sheet-save').click()
    await expect(groups.getByTestId('group-Rishikesh')).toBeVisible()

    await groups.getByTestId('group-Rishikesh').click()
    await page.getByTestId('group-make-active').click()
    await expect(page.getByTestId('group-inactive-notice')).toHaveCount(0)
    await expect(page.getByTestId('group-add-expense')).toBeVisible()
  })

  test(`${name}: hide is personal: out of my list, found by filter and search, still takes expenses, show brings it back`, async ({page}) => {
    await page.setViewportSize({width, height})
    await ready(page)
    const {group} = await seed(page)
    await page.goto(`/groups/${group}`)
    await page.getByTestId('group-more').click()
    await page.getByTestId('group-menu-hide').click()
    await expect(page.getByTestId('group-hidden-notice')).toBeVisible()
    // Still active, so adding from its own page works.
    await expect(page.getByTestId('group-add-expense')).toBeVisible()

    await page.goto('/groups')
    const groups = page.getByTestId('screen-groups')
    await expect(groups.getByTestId('group-Rishikesh')).toHaveCount(0)
    await groups.getByTestId('list-search').click()
    await groups.getByTestId('list-search-input').fill('rishi')
    await expect(groups.getByTestId('group-Rishikesh')).toContainText('Hidden')
    await groups.getByTestId('searchTextInputClearBtn').click()
    await groups.getByTestId('list-filters').click()
    await page.getByTestId('filter-show-hidden').click()
    await page.getByTestId('sheet-save').click()
    await expect(groups.getByTestId('group-Rishikesh')).toBeVisible()

    await groups.getByTestId('group-Rishikesh').click()
    await page.getByTestId('group-show').click()
    await expect(page.getByTestId('group-hidden-notice')).toHaveCount(0)
    await page.goto('/groups')
    await expect(page.getByTestId('screen-groups').getByTestId('group-Rishikesh')).toBeVisible()
  })
}

test('remove a member: settle previews every balance change, then the member is marked as left', async ({page}) => {
  await ready(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}`)
  await page.getByTestId('group-tab-members').click()
  await page.getByTestId('member-Bela Joshi-more').click()
  await page.getByTestId('member-Bela Joshi-exit').click()
  await expect(page.getByTestId('member-exit-sheet')).toBeVisible()
  await expect(page.getByTestId('member-exit-owed-INR')).toContainText('owes ₹100.00')
  // A balance needs a choice before it can be saved.
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('member-exit-settle').click()
  await expect(page.getByTestId('member-exit-change-INR-Bela Joshi')).toContainText('owes ₹100.00 → settled up')
  await expect(page.getByTestId('member-exit-change-INR-Chirag Shah')).toContainText('is owed ₹200.00 → is owed ₹100.00')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByText('Bela Joshi was removed from Rishikesh')).toBeVisible()
  await expect(page.getByTestId('member-Bela Joshi')).toContainText('Left the group')
  // The payment is in the group's history; Bela owes nothing.
  await page.getByTestId('group-tab-balances').click()
  await expect(page.getByTestId('group-net-INR-Bela Joshi-text')).toHaveText('settled up')
})

test('keep as inactive leaves the balance open; the choice shows in Activity', async ({page}) => {
  await ready(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}`)
  await page.getByTestId('group-tab-members').click()
  await page.getByTestId('member-Bela Joshi-more').click()
  await page.getByTestId('member-Bela Joshi-exit').click()
  await page.getByTestId('member-exit-keep').click()
  await expect(page.getByTestId('member-exit-preview')).toContainText('Nobody’s balance changes')
  await page.getByTestId('sheet-save').click()
  await page.getByTestId('group-tab-balances').click()
  await expect(page.getByTestId('group-net-INR-Bela Joshi-text')).toContainText('owes')
  await page.goto('/activity')
  await expect(page.getByText('Left with a balance still open')).toBeVisible()
})

test('leaving as the last admin asks who takes over; then I am out and told so', async ({page}) => {
  await ready(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}`)
  await page.getByTestId('group-more').click()
  await page.getByTestId('group-menu-leave').click()
  await expect(page.getByText('Who runs the group next?')).toBeVisible()
  await page.getByTestId('member-exit-keep').click()
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('member-exit-admin-Chirag Shah').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('group-left-notice')).toBeVisible()
  await page.getByTestId('group-tab-members').click()
  await expect(page.getByTestId('member-Chirag Shah')).toContainText('Admin')
  // I am no admin now: no remove menu on anyone's row, and no Delete group.
  await expect(page.getByTestId('member-Chirag Shah-more')).toHaveCount(0)
  await page.getByTestId('group-more').click()
  await expect(page.getByTestId('group-menu-hide')).toBeVisible()
  await expect(page.getByTestId('group-menu-delete')).toHaveCount(0)
})

test('delete group lists what goes, keeps the group struck in Groups, and restores everything', async ({page}) => {
  await ready(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}`)
  await page.getByTestId('group-more').click()
  await page.getByTestId('group-menu-delete').click()
  await expect(page.getByTestId('delete-group-contents')).toContainText('1 expense')
  await page.getByTestId('delete-group-confirm').click()
  await expect(page).toHaveURL(/\/groups$/)
  // It stays in the list, struck, with its chip.
  await expect(page.getByTestId('group-Rishikesh')).toContainText('Deleted')

  await page.goto(`/groups/${group}`)
  await expect(page.getByTestId('group-deleted')).toBeVisible()
  await page.getByTestId('group-restore').click()
  await expect(page.getByTestId('group-deleted')).toHaveCount(0)
  await expect(page.getByTestId('group-name')).toHaveText('Rishikesh')
  await page.getByTestId('group-tab-balances').click()
  await expect(page.getByTestId('group-net-INR-Chirag Shah-text')).toContainText('is owed')
})

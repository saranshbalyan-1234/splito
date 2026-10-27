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

test('archive hides the group from Active, keeps it under Archived, and unarchive brings it back', async ({page}) => {
  await ready(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}`)
  await page.getByTestId('group-more').click()
  await page.getByTestId('group-menu-archive').click()
  await expect(page.getByTestId('group-archived-notice')).toBeVisible()

  await page.goto('/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('group-Rishikesh')).toHaveCount(0)
  await groups.getByTestId('list-filters').click()
  await page.getByTestId('filter-status-archived').click()
  await page.getByTestId('sheet-save').click()
  await expect(groups.getByTestId('group-Rishikesh')).toBeVisible()

  await groups.getByTestId('group-Rishikesh').click()
  await page.getByTestId('group-unarchive').click()
  await expect(page.getByTestId('group-archived-notice')).toHaveCount(0)
})

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
})

test('delete group lists what goes, shows as one Recently deleted entry, and restores everything', async ({page}) => {
  await ready(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}`)
  await page.getByTestId('group-more').click()
  await page.getByTestId('group-menu-delete').click()
  await expect(page.getByTestId('delete-group-contents')).toContainText('1 expense')
  await page.getByTestId('delete-group-confirm').click()
  await expect(page).toHaveURL(/\/groups$/)
  await expect(page.getByTestId('group-Rishikesh')).toHaveCount(0)

  await page.goto('/settings/recently-deleted')
  await expect(page.getByTestId('bin-count')).toHaveText('1 item')
  const row = page.locator('[data-testid^="bin-row-"]', {hasText: 'Rishikesh'})
  await expect(row).toContainText('1 record')
  await row.click()
  await expect(page.getByTestId('restore-sheet')).toContainText('Expenses')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByText('Group restored')).toBeVisible()
  await page.goto(`/groups/${group}`)
  await expect(page.getByTestId('group-name')).toHaveText('Rishikesh')
  await page.getByTestId('group-tab-balances').click()
  await expect(page.getByTestId('group-net-INR-Chirag Shah-text')).toContainText('is owed')
})

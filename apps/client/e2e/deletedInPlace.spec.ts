import {expect, type Page, test} from '@playwright/test'

/*
 * F-1203 (owner 98, 103 to 106): a deleted item stays in its list, struck through with a clock and "Deleted <time>",
 * never counted; it opens read-only with Restore. Hide is personal and only for deleted items; one "Show hidden"
 * filter brings hidden ones back. Seeded through the app's own mutations (window.splito).
 */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
  deleteExpense(id: string): Promise<void>
  deletePerson(id: string): Promise<void>
}

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
}

/** Rishikesh with Bela: Rafting (5 Sep, 450) and Camp (7 Sep, 300) both split equally with me paying. */
async function seed(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const bela = await s.createPerson('Bela Joshi')
    const group = await s.createGroup({name: 'Rishikesh', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [bela]})
    const draft = (title: string, total: string, date: string) => ({
      title, groupId: group, currency: 'INR', total, payers: {[s.me]: total},
      split: {mode: 'equal', participants: [s.me, bela]}, date, tz: 'Asia/Kolkata', category: 'food', notes: '',
    })
    const rafting = await s.createExpense(draft('Rafting', '45000', '2026-09-05'))
    const camp = await s.createExpense(draft('Camp fire', '30000', '2026-09-07'))
    return {bela, group, rafting, camp}
  })
}

const STRUCK = 'line-through'
const DELETED = /^Deleted (just now|\d+ (minute|hour|day)s? ago)$/

for (const {name, width, height} of [
  {name: 'phone', width: 390, height: 844},
  {name: 'desktop', width: 1440, height: 900},
]) {
  test.describe(name, () => {
    test.beforeEach(async ({page}) => {
      await page.setViewportSize({width, height})
      await ready(page)
    })

    test('delete an expense: it stays struck in the group list in date order with a clock and time, the balance drops it, and it restores from its page', async ({page}) => {
      const {group, rafting, camp} = await seed(page)
      await page.goto(`/groups/${group}?tab=balances`)
      await expect(page.getByTestId('group-net-INR-Bela Joshi-text')).toContainText('375.00')

      // Delete from the expense page, as a person would.
      await page.goto(`/expense/${camp}`)
      await page.getByTestId('expense-menu').click()
      await page.getByTestId('expense-delete').click()
      // The write must land before a hard navigation drops the page.
      await expect(page.getByText('Expense deleted')).toBeVisible()
      await page.goto(`/groups/${group}`)

      const row = page.getByTestId(`history-${camp}`)
      await expect(row).toBeVisible()
      // Newest date first, so the deleted Camp fire sits above Rafting, in its place.
      const above = (await row.boundingBox())!.y
      const below = (await page.getByTestId(`history-${rafting}`).boundingBox())!.y
      expect(above).toBeLessThan(below)
      await expect(row.getByText('Camp fire')).toHaveCSS('text-decoration-line', STRUCK)
      const meta = page.getByTestId(`history-${camp}-deleted`)
      await expect(meta).toContainText(DELETED)
      await expect(page.getByTestId(`history-${camp}-deleted-clock`).locator('svg')).toBeVisible()
      await expect(meta.getByText(/^Deleted/)).toHaveAttribute('data-tooltip', /\d{4}|\d{1,2}:\d{2}/)
      // The live one is not struck and has no Hide.
      await expect(page.getByTestId(`history-${rafting}`).getByText('Rafting')).not.toHaveCSS('text-decoration-line', STRUCK)
      await expect(page.getByTestId(`history-${rafting}-more`)).toHaveCount(0)

      // The balance counts only Rafting: Bela owes 225.
      await page.getByTestId('group-tab-balances').click()
      await expect(page.getByTestId('group-net-INR-Bela Joshi-text')).toContainText('225.00')

      // Open it: read-only, struck, with Restore.
      await page.getByTestId('group-tab-expenses').click()
      await row.click()
      await expect(page.getByTestId('expense-deleted')).toBeVisible()
      await expect(page.getByTestId('expense-detail-title')).toHaveCSS('text-decoration-line', STRUCK)
      await expect(page.getByTestId('expense-edit-button')).toHaveCount(0)
      await page.getByTestId('expense-restore').click()
      await expect(page.getByTestId('expense-deleted')).toHaveCount(0)
      await page.goto(`/groups/${group}?tab=balances`)
      await expect(page.getByTestId('group-net-INR-Bela Joshi-text')).toContainText('375.00')
    })

    test('delete a group: it stays struck in Groups with a Deleted chip, opens read-only with its records struck, and restores', async ({page}) => {
      const {group, rafting} = await seed(page)
      await page.goto(`/groups/${group}`)
      await page.getByTestId('group-more').click()
      await page.getByTestId('group-menu-delete').click()
      await page.getByTestId('delete-group-confirm').click()
      await expect(page).toHaveURL(/\/groups$/)

      const row = page.getByTestId('screen-groups').getByTestId('group-Rishikesh')
      await expect(row).toBeVisible()
      await expect(row).toContainText('Deleted')
      await expect(row.getByText('Rishikesh', {exact: true})).toHaveCSS('text-decoration-line', STRUCK)
      await expect(page.getByTestId(`group-${group}-deleted`)).toContainText(DELETED)
      // Never counted: the Overview has no open balance from it.
      await expect(page.getByTestId('groups-balances')).not.toContainText('225')

      await row.click()
      // The Groups list keeps the page it came from under this one, so reload to one instance (also checks § 26.3).
      await expect(page).toHaveURL(new RegExp(`/groups/${group}`))
      await page.reload()
      await expect(page.getByTestId('group-deleted')).toBeVisible()
      await expect(page.getByTestId('group-add-expense')).toHaveCount(0)
      await expect(page.getByTestId('group-settle')).toBeDisabled()
      await expect(page.getByTestId(`history-${rafting}`).getByText('Rafting')).toHaveCSS('text-decoration-line', STRUCK)

      await page.getByTestId('group-restore').click()
      await expect(page.getByTestId('group-deleted')).toHaveCount(0)
      await expect(page.getByTestId('group-add-expense')).toBeVisible()
      await expect(page.getByTestId(`history-${rafting}`).getByText('Rafting')).not.toHaveCSS('text-decoration-line', STRUCK)
      await page.getByTestId('group-tab-balances').click()
      await expect(page.getByTestId('group-net-INR-Bela Joshi-text')).toContainText('375.00')
    })

    test('Hide is for a deleted expense only; hiding it removes it, and Show hidden brings it back with Unhide', async ({page}) => {
      const {group, camp, rafting} = await seed(page)
      await page.evaluate(id => (window as unknown as {splito: Splito}).splito.deleteExpense(id), camp)
      await page.goto(`/groups/${group}`)
      // A live expense has no Hide; a deleted one has.
      await expect(page.getByTestId(`history-${rafting}-more`)).toHaveCount(0)
      await page.getByTestId(`history-${camp}-more`).click()
      await page.getByTestId(`history-${camp}-more-hide`).click()
      await expect(page.getByTestId(`history-${camp}`)).toHaveCount(0)
      await expect(page.getByTestId(`history-${rafting}`)).toBeVisible()

      await page.getByTestId('group-filter').click()
      await page.getByTestId('filter-show-hidden').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId(`history-${camp}`)).toBeVisible()
      await expect(page.getByTestId(`history-${camp}-hidden`)).toBeVisible()
      await page.getByTestId(`history-${camp}-more`).click()
      await page.getByTestId(`history-${camp}-more-unhide`).click()
      await expect(page.getByTestId(`history-${camp}-hidden`)).toHaveCount(0)

      // Remembered: a reload keeps the switch.
      await page.reload()
      await expect(page.getByTestId(`history-${camp}`)).toBeVisible()
    })

    test('a removed friend stays in People struck; Show hidden covers friends and groups with the one switch', async ({page}) => {
      const {bela, group, rafting, camp} = await seed(page)
      await page.evaluate(
        async ids => {
          const s = (window as unknown as {splito: Splito}).splito
          for (const id of ids) await s.deleteExpense(id)
        },
        [rafting, camp],
      )
      // The group still lists Bela, so he is in use; remove the group from the picture first by deleting it.
      await page.goto(`/groups/${group}`)
      await page.getByTestId('group-more').click()
      await page.getByTestId('group-menu-delete').click()
      await page.getByTestId('delete-group-confirm').click()
      await expect(page).toHaveURL(/\/groups$/)
      await page.evaluate(id => (window as unknown as {splito: Splito}).splito.deletePerson(id), bela)

      await page.goto('/')
      const friend = page.getByTestId('screen-people').getByTestId('person-Bela Joshi')
      await expect(friend).toBeVisible()
      await expect(friend).toContainText('Deleted')
      await expect(friend.getByText('Bela Joshi', {exact: true})).toHaveCSS('text-decoration-line', STRUCK)
      // Right-click opens the same menu as the "..." button.
      await friend.click({button: 'right'})
      await page.getByTestId(`person-${bela}-more-hide`).click()
      await expect(friend).toHaveCount(0)

      // The one Show hidden switch, in People's filters, brings back the friend ...
      await page.getByTestId('screen-people').getByTestId('list-filters').click()
      await page.getByTestId('filter-show-hidden').click()
      await page.getByTestId('sheet-save').click()
      await expect(friend).toBeVisible()
      // ... and, being the same switch, a hidden deleted group in Groups.
      await page.goto('/groups')
      const groupRow = page.getByTestId('screen-groups').getByTestId('group-Rishikesh')
      await expect(groupRow).toBeVisible()
      await groupRow.click({button: 'right'})
      await page.getByTestId(`group-${group}-more-hide`).click()
      // Show hidden is on (one remembered switch), so it stays, now offering Unhide; switching it off removes it.
      await expect(groupRow).toBeVisible()
      await page.getByTestId('screen-groups').getByTestId('list-filters').click()
      await page.getByTestId('filter-show-hidden').click()
      await page.getByTestId('sheet-save').click()
      await expect(groupRow).toHaveCount(0)
      await page.reload()
      await expect(page.getByTestId('screen-groups')).toBeVisible()
      await expect(groupRow).toHaveCount(0)
    })

    test('Search lists a deleted expense struck, and the old Recently deleted link says deleted items stay in their lists', async ({page}) => {
      const {camp} = await seed(page)
      await page.evaluate(id => (window as unknown as {splito: Splito}).splito.deleteExpense(id), camp)
      await page.goto('/search?q=camp')
      await expect(page.getByTestId(`search-deleted-${camp}`)).toContainText('Deleted')
      await page.goto('/settings/recently-deleted')
      await expect(page).toHaveURL(/\/settings(\?|$)/)
      await expect(page.getByTestId('settings-deleted-note')).toContainText('Deleted items now stay in their lists')
      await expect(page.getByTestId('settings-recently-deleted')).toHaveCount(0)
    })
  })
}

import {expect, type Page, test} from '@playwright/test'

/* Owner 98: a deleted record shows its title and amount struck through, then a clock and "Deleted <time>". */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
  deleteExpense(id: string): Promise<void>
}

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
}

async function seed(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const b = await s.createPerson('Bela Joshi')
    const group = await s.createGroup({name: 'Rishikesh', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [b]})
    const draft = (title: string, groupId: string | null) => ({
      title, groupId, currency: 'INR', total: '45000', payers: {[s.me]: '45000'},
      split: {mode: 'equal', participants: [s.me, b]}, date: '2026-09-05', tz: 'Asia/Kolkata', category: 'food', notes: '',
    })
    const pizza = await s.createExpense(draft('Pizza night', null))
    await s.createExpense(draft('Rafting', group))
    await s.deleteExpense(pizza)
    return {pizza, group}
  })
}

for (const {name, width, height} of [
  {name: 'phone', width: 390, height: 844},
  {name: 'desktop', width: 1440, height: 900},
]) {
  test(`${name}: Recently deleted strikes the title and amount, then a clock and "Deleted <time>"; counts stay plain`, async ({page}) => {
    await page.setViewportSize({width, height})
    await ready(page)
    const {pizza, group} = await seed(page)
    await page.goto(`/groups/${group}`)
    await page.getByTestId('group-more').click()
    await page.getByTestId('group-menu-delete').click()
    await page.getByTestId('delete-group-confirm').click()
    // The delete runs after the prompt closes: wait for it to land before leaving the page.
    await expect(page).toHaveURL(/\/groups$/)
    await page.goto('/settings/recently-deleted')

    const title = page.getByTestId(`bin-title-${pizza}`)
    await expect(title).toHaveText('Pizza night')
    await expect(title).toHaveCSS('text-decoration-line', 'line-through')
    await expect(page.getByTestId(`bin-amount-${pizza}`)).toHaveCSS('text-decoration-line', 'line-through')
    const meta = page.getByTestId(`bin-deleted-${pizza}`)
    await expect(meta).toContainText(/^Deleted (just now|\d+ (minute|hour|day)s? ago)$/)
    await expect(page.getByTestId(`bin-deleted-${pizza}-clock`).locator('svg')).toBeVisible()
    // The exact date and time is the tooltip, and the label for assistive tech.
    await expect(meta.getByText(/^Deleted/)).toHaveAttribute('data-tooltip', /\d{4}|\d{1,2}:\d{2}/)
    await expect(meta).toHaveAttribute('aria-label', /^Deleted, /)

    // The deleted group's entry: title struck, its record count and "days left" are not.
    const groupRow = page.locator('[data-testid^="bin-row-"]', {hasText: 'Rishikesh'})
    await expect(groupRow.locator('[data-testid^="bin-title-"]')).toHaveCSS('text-decoration-line', 'line-through')
    await expect(groupRow.locator('[data-testid^="bin-amount-"]')).toHaveText('1 record')
    await expect(groupRow.locator('[data-testid^="bin-amount-"]')).not.toHaveCSS('text-decoration-line', 'line-through')

    // The restore sheet and Activity say the same.
    await page.getByTestId(`bin-row-${pizza}`).click()
    await expect(page.getByTestId('restore-title')).toHaveCSS('text-decoration-line', 'line-through')
    await expect(page.getByTestId('restore-amount')).toHaveCSS('text-decoration-line', 'line-through')
    await expect(page.getByTestId('restore-deleted')).toContainText('Deleted')
    await page.getByTestId('sheet-cancel').click()

    await page.goto('/activity')
    const row = page.locator('[data-testid="activity-deleted"]').first()
    await expect(row).toContainText('Deleted')
    await expect(page.getByText('Pizza night').first()).toHaveCSS('text-decoration-line', 'line-through')
  })

  test(`${name}: the detail page of a deleted expense is struck through with when it was deleted`, async ({page}) => {
    await page.setViewportSize({width, height})
    await ready(page)
    const {pizza} = await seed(page)
    await page.goto(`/expense/${pizza}`)
    await expect(page.getByTestId('expense-deleted')).toBeVisible()
    await expect(page.getByTestId('expense-detail-title')).toHaveCSS('text-decoration-line', 'line-through')
    await expect(page.getByTestId('expense-detail-amount')).toHaveCSS('text-decoration-line', 'line-through')
    await expect(page.getByTestId('expense-deleted-at')).toContainText('Deleted')
  })
}

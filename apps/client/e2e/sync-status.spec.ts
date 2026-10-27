import {expect, type Page, test} from '@playwright/test'

/*
 * F-117: every row carries its own sync state (ARCHITECTURE 9.8), shown as a
 * small dot on rows and in words on detail pages, in the avatar dot's colours.
 * With no backend nothing is ever "Synced": a queued row says it is saved on
 * this device, and the dot is red.
 */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
  createRepayment(input: unknown): Promise<string>
  setOpState(entityId: string, status: 'sending' | 'acked' | 'failed', error?: string): Promise<void>
  setPref(key: string, value: unknown): Promise<void>
}

async function seed(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const friend = await s.createPerson('Kavya Rao')
    const expense = await s.createExpense({
      title: 'Concert',
      groupId: null,
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      total: '20000',
      payers: {[s.me]: '20000'},
      split: {mode: 'equal', participants: [s.me, friend]},
      date: '2026-10-20',
    })
    const payment = await s.createRepayment({
      groupId: null,
      currency: 'INR',
      from: friend,
      to: s.me,
      amount: '5000',
      date: '2026-10-21',
      tz: 'Asia/Kolkata',
      note: '',
    })
    return {friend, expense, payment}
  })
}

test('rows and detail pages say a queued row is saved on this device, never synced', async ({page}) => {
  const {friend, expense, payment} = await seed(page)
  await page.goto(`/people/${friend}`)
  const dot = page.getByTestId(`sync-${expense}`)
  await expect(dot).toBeVisible()
  await expect(dot).toHaveAttribute('aria-label', 'Saved on this device')
  await expect(page.getByTestId(`sync-${payment}`)).toHaveAttribute('aria-label', 'Saved on this device')

  // The expense page: the marker in words beside the date, and the same state in the history footer.
  await page.getByTestId(`history-${expense}`).click()
  await expect(page.getByTestId('expense-sync-chip-label')).toHaveText('Saved on this device')
  await expect(page.getByTestId('expense-sync-status')).toContainText('Saved on this device')

  // The payment's details.
  await page.goBack()
  await page.getByTestId(`history-${payment}`).click()
  await expect(page.getByTestId('payment-sync-status-label')).toHaveText('Saved on this device')
})

test('a sending row is yellow, a refused one is written out; even an acknowledged row is not called synced without an account', async ({page}) => {
  const {friend, expense} = await seed(page)
  await page.goto(`/people/${friend}`)
  const dot = page.getByTestId(`sync-${expense}`)
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'sending'), expense)
  // No account yet: the engine would never run, but the state is still shown as what it is.
  await expect(dot).toHaveAttribute('aria-label', 'Syncing')
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'failed', 'Refused'), expense)
  await expect(page.getByTestId(`history-${expense}`)).toContainText('Needs attention')
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'acked'), expense)
  await expect(dot).toHaveAttribute('aria-label', 'Saved on this device')
})

test('Settings > Sync status hides the routine dots; detail pages still say it', async ({page}) => {
  const {friend, expense} = await seed(page)
  await page.goto(`/people/${friend}`)
  await expect(page.getByTestId(`sync-${expense}`)).toBeVisible()
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.setPref('showSyncStatus', false))
  await expect(page.getByTestId(`sync-${expense}`)).toHaveCount(0)
  await page.getByTestId(`history-${expense}`).click()
  await expect(page.getByTestId('expense-sync-chip-label')).toHaveText('Saved on this device')
})

test('the marker holds at phone and desktop widths without overflow', async ({page}) => {
  const {friend} = await seed(page)
  for (const size of [
    {width: 320, height: 700},
    {width: 390, height: 844},
    {width: 1440, height: 900},
  ]) {
    await page.setViewportSize(size)
    await page.goto(`/people/${friend}`)
    await expect(page.getByTestId('screen-person')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
})

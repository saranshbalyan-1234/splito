import {expect, type Locator, type Page, test} from '@playwright/test'

/*
 * F-117 / F-244: every row carries its own sync state (ARCHITECTURE 9.8). An
 * unsynced row (local, pending, syncing) is drawn in text_contrast_medium and
 * fades to full strength when the server acknowledges; a refused one keeps full
 * strength and says "Needs attention". Detail pages say it in words. With no
 * backend nothing is ever "Synced".
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

/** The computed colour of the first text with this content inside a row. */
const colourOf = (row: Locator, text: string) => row.getByText(text, {exact: true}).first().evaluate(el => getComputedStyle(el).color)
const MEDIUM_LIGHT = 'rgb(64, 81, 104)' // text_contrast_medium in the light theme (#405168)

test('an unsynced row draws its title lighter and says "not synced yet"; the words live on the detail page', async ({page}) => {
  const {friend, expense, payment} = await seed(page)
  await page.goto(`/people/${friend}`)
  const row = page.getByTestId(`history-${expense}`)
  await expect(row).toBeVisible()
  expect(await colourOf(row, 'Concert')).toBe(MEDIUM_LIGHT)
  await expect(row).toHaveAttribute('aria-label', /not synced yet/i)
  await expect(page.getByTestId(`history-${payment}`)).toHaveAttribute('aria-label', /not synced yet/i)
  // No per-row marker any more (decision 111); the avatar dot stays the aggregate.
  await expect(page.getByTestId(`sync-${expense}`)).toHaveCount(0)

  // The expense page: one line in words (the history footer), no dot, no second chip.
  await row.click()
  await expect(page.getByTestId('expense-sync-chip')).toHaveCount(0)
  await expect(page.getByTestId('expense-sync-status')).toContainText('Saved on this device')

  // The payment's details.
  await page.goBack()
  await page.getByTestId(`history-${payment}`).click()
  await expect(page.getByTestId('payment-sync-status-label')).toHaveText('Saved on this device')
})

test('an acknowledged row fades to full strength; a refused one keeps it and says Needs attention', async ({page}) => {
  const {friend, expense} = await seed(page)
  await page.goto(`/people/${friend}`)
  // The dev tools bind when the store is adopted, a moment after the page loads.
  await page.waitForFunction(() => 'splito' in window)
  const row = page.getByTestId(`history-${expense}`)
  expect(await colourOf(row, 'Concert')).toBe(MEDIUM_LIGHT)
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'sending'), expense)
  // Syncing is still lighter.
  expect(await colourOf(row, 'Concert')).toBe(MEDIUM_LIGHT)
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'failed', 'Refused'), expense)
  await expect(page.getByTestId(`sync-${expense}`)).toHaveText('Needs attention')
  await expect.poll(() => colourOf(row, 'Concert')).not.toBe(MEDIUM_LIGHT)
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'sending'), expense)
  await expect.poll(() => colourOf(row, 'Concert')).toBe(MEDIUM_LIGHT)
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'acked'), expense)
  await expect.poll(() => colourOf(row, 'Concert')).not.toBe(MEDIUM_LIGHT)
  await expect(page.getByTestId(`sync-${expense}`)).toHaveCount(0)
  await expect(row).not.toHaveAttribute('aria-label', /not synced yet/i)
})

test('a People row is lighter while its friend record is unsynced and full strength once acknowledged', async ({page}) => {
  await seed(page)
  const lena = await page.evaluate(() => (window as unknown as {splito: Splito}).splito.createPerson('Lone Lena'))
  await page.goto('/people')
  const row = page.getByTestId('person-Lone Lena')
  await expect(row).toBeVisible()
  expect(await colourOf(row, 'Lone Lena')).toBe(MEDIUM_LIGHT)
  await expect(row).toHaveAttribute('aria-label', /not synced yet/i)
  await page.evaluate(id => (window as unknown as {splito: Splito}).splito.setOpState(id, 'acked'), lena)
  await expect.poll(() => colourOf(row, 'Lone Lena')).not.toBe(MEDIUM_LIGHT)
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

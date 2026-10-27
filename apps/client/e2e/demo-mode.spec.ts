import {expect, type Page, test} from '@playwright/test'

/*
 * The large demo set (F-227): added from Settings in an e2e build, counted,
 * timed, and removed again, leaving what was there before.
 */
test.setTimeout(120_000)

async function addFromSettings(page: Page) {
  await page.goto('/settings')
  await expect(page.getByTestId('settings-demo-add')).toBeVisible()
  await page.getByTestId('settings-demo-add').click()
  const started = Date.now()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('settings-demo-summary')).toContainText(
    '12 groups',
    {timeout: 30_000},
  )
  return Date.now() - started
}

test('Add demo data loads a year of data in under 10 s; Remove restores what was there', async ({
  page,
}) => {
  // Something of the user's own first: the small demo set.
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()

  const ms = await addFromSettings(page)
  console.log(`large demo added in ${ms} ms`)
  expect(ms).toBeLessThan(10_000)
  const summary = page.getByTestId('settings-demo-summary')
  await expect(summary).toContainText('30 friends')
  await expect(summary).toContainText(/1,[45]\d\d expenses/)
  await expect(page.getByTestId('settings-demo-remove')).toBeVisible()

  // The data shows on the screens, next to the user's own.
  await page.goto('/groups')
  await expect(page.getByTestId('group-Tokyo')).toBeVisible()
  await expect(page.getByTestId('group-Goa getaway')).toBeVisible()
  await expect(page.getByTestId('group-Goa trip')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()

  // Adding twice does not duplicate.
  await page.goto('/settings')
  await page.getByTestId('settings-demo-add').click()
  await expect(page.getByText('Demo data is already added')).toBeVisible()
  await page.goto('/groups')
  await expect(page.getByTestId('group-Tokyo')).toHaveCount(1)

  // Remove takes exactly the demo set away.
  await page.goto('/settings')
  await page.getByTestId('settings-demo-remove').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('settings-demo-remove')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('settings-demo-summary')).toContainText(
    'A year of friends',
  )
  await page.goto('/groups')
  await expect(page.getByTestId('group-Goa trip')).toHaveCount(1)
  await expect(page.getByTestId('group-Tokyo')).toHaveCount(0)
  await expect(page.getByTestId('group-Lisbon')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  await expect(page.getByTestId('person-Kabir Singh')).toHaveCount(0)
})

test('?demo=large loads the set on open', async ({page}) => {
  await page.goto('/groups?demo=large')
  await expect(page.getByTestId('group-Coorg road trip')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByTestId('group-Flat 4B')).toBeVisible()
  await expect(page.getByText(/Demo data added/)).toBeVisible({timeout: 30_000})

  // A year of activity renders a page at a time, and the next page comes in on scroll.
  await page.goto('/activity')
  const rows = page.locator('[data-testid^="activity-expense."]')
  await expect(rows.first()).toBeVisible()
  const first = await rows.count()
  expect(first).toBeLessThanOrEqual(30)
  await page.mouse.wheel(0, 50_000)
  await expect.poll(() => rows.count()).toBeGreaterThan(first)
})

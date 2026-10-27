import {expect, type Page, test} from '@playwright/test'

import {closeDemo, openDemo} from './openDemo'

/*
 * Demo mode (F-228a, ARCHITECTURE 26.1): a Settings > Data switch onto a
 * separate local database holding the one demo dataset. The real data is never
 * read or written by it.
 */
test.setTimeout(180_000)

type Splito = {createPerson(name: string): Promise<string>; list(type: string): Promise<Array<{id: string; data: {name?: string}}>>}
const names = (page: Page, type: string) =>
  page.evaluate(async t => (await (window as unknown as {splito: Splito}).splito.list(t)).map(e => e.data.name), type)

test('Settings > Data has the Demo mode switch, no Add / Remove demo data, and nothing is on until it is turned on', async ({page}) => {
  await page.goto('/settings')
  await expect(page.getByTestId('settings-demo-mode')).toBeVisible()
  await expect(page.getByText('Explore Splito with sample data. Your own data is kept separately and untouched.')).toBeVisible()
  await expect(page.getByTestId('settings-demo-reset')).toHaveCount(0)
  for (const gone of ['Add demo data', 'Remove demo data']) await expect(page.getByText(gone)).toHaveCount(0)
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByTestId('people-empty')).toBeVisible()
})

test('turning it on seeds the demo database in under 10 s, shows the banner and "Demo", and a reload keeps the mode', async ({page}) => {
  await page.goto('/settings')
  await expect(page.getByTestId('settings-demo-mode')).toBeVisible()
  const started = Date.now()
  await page.getByTestId('settings-demo-mode').click()
  await expect(page.getByTestId('demo-banner').last()).toBeVisible({timeout: 30_000})
  const ms = Date.now() - started
  console.log(`demo mode on in ${ms} ms`)
  expect(ms).toBeLessThan(10_000)
  await expect(page.getByTestId('settings-demo-reset')).toBeVisible()
  await expect(page.getByTestId('header-avatar').last()).toHaveAttribute('aria-label', /Demo$/)
  await expect(page.getByTestId('header-avatar').last().getByTestId('sync-dot-demo')).toBeAttached()

  // On every screen with a header, and above it: never covering one.
  for (const [path, screen] of [
    ['/', 'screen-people'],
    ['/groups', 'screen-groups'],
    ['/activity', 'screen-activity'],
    ['/analytics', 'screen-analytics'],
    ['/settings', 'screen-settings'],
  ] as const) {
    await page.goto(path)
    const s = page.getByTestId(screen)
    await expect(s.getByTestId('demo-banner')).toBeVisible({timeout: 30_000})
    const banner = (await s.getByTestId('demo-banner').boundingBox())!
    // The header's own first control (the avatar, or Back) is below the banner, never under it.
    const control = (await s.getByTestId('header-avatar').or(s.getByRole('button', {name: 'Go back'})).first().boundingBox())!
    expect(control.y).toBeGreaterThanOrEqual(banner.y + banner.height - 1)
  }

  // A year of activity: a page at a time, the next on scroll.
  await page.goto('/groups')
  await expect(page.getByTestId('group-Tokyo')).toBeVisible()
  await expect(page.getByTestId('group-Goa trip')).toBeVisible()
  await expect(page.getByTestId('group-Goa getaway')).toBeVisible()
  await page.goto('/activity')
  const rows = page.locator('[data-testid^="activity-expense."]')
  await expect(rows.first()).toBeVisible()
  const first = await rows.count()
  expect(first).toBeLessThanOrEqual(30)
  await page.mouse.wheel(0, 50_000)
  await expect.poll(() => rows.count()).toBeGreaterThan(first)

  // A reload keeps the mode (the real database says so; the demo one opens).
  await page.reload()
  await expect(page.getByTestId('demo-banner').last()).toBeVisible({timeout: 30_000})
  await page.waitForFunction(() => 'splito' in window)
  expect(await names(page, 'person')).toContain('Riya Sharma')
})

test('the real data is untouched by a demo session; Switch back returns Home with it, and demo edits wait in their own database', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.createPerson('Real Asha'))
  const realBefore = await names(page, 'person')
  expect(realBefore).toContain('Real Asha')

  await openDemo(page)
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  expect(await names(page, 'person')).not.toContain('Real Asha')
  // An edit inside demo mode goes to the demo database.
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.createPerson('Typed in demo'))
  expect(await names(page, 'person')).toContain('Typed in demo')

  // Switch back from the banner: Home, with the real data and none of the demo.
  await page.goto('/groups')
  await page.getByTestId('demo-banner-switch-back').last().click()
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('person-Real Asha').last()).toBeVisible()
  await expect(page.getByTestId('person-Riya Sharma')).toHaveCount(0)
  const realAfter = await names(page, 'person')
  expect(realAfter.sort()).toEqual(realBefore.sort())
  await expect(page.getByTestId('header-avatar').last()).not.toHaveAttribute('aria-label', /Demo$/)
  // The switch is off again and a reload stays on the real data.
  await page.reload()
  await expect(page.getByTestId('person-Real Asha').last()).toBeVisible()
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)

  // Back on: the demo database kept its own edit.
  await openDemo(page)
  expect(await names(page, 'person')).toContain('Typed in demo')

  // Reset demo drops it and seeds the dataset again.
  await page.goto('/settings')
  await page.getByTestId('settings-demo-reset').click()
  await page.getByTestId('confirmBtn').click()
  await expect.poll(async () => { const n = await names(page, 'person'); return n.includes('Riya Sharma') && !n.includes('Typed in demo') }, {timeout: 60_000}).toBe(true)
  await closeDemo(page)
  expect(await names(page, 'person')).toContain('Real Asha')
})

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
  // The switch takes the app to the first tab: what was open belonged to the other database.
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByTestId('header-avatar').last()).toHaveAttribute('aria-label', /Demo$/)
  await expect(page.getByTestId('header-avatar').last().getByTestId('sync-dot-demo')).toBeAttached()
  await page.goto('/settings')
  await expect(page.getByTestId('settings-demo-reset')).toBeVisible()

  // The banner is the shell's, drawn once above EVERY screen: pages, Search, composers, invites and sign-in.
  for (const [path, screen] of [
    ['/', 'screen-people'],
    ['/groups', 'screen-groups'],
    ['/activity', 'screen-activity'],
    ['/analytics', 'screen-analytics'],
    ['/settings', 'screen-settings'],
    ['/search', 'screen-search-redirect'],
    ['/expense/new', 'screen-add-expense'],
    ['/friends/new', 'screen-add-friend'],
    ['/groups/new', 'screen-create-group'],
    ['/invites', 'screen-invite-links'],
    ['/signin', 'screen-sign-in'],
  ] as const) {
    await page.goto(path)
    const banner = page.getByTestId('demo-banner')
    await expect(banner, `${path}: one banner`).toHaveCount(1, {timeout: 30_000})
    await expect(banner).toBeVisible()
    const box = (await banner.boundingBox())!
    const found = page.getByTestId(screen).first()
    const screenBox = (await found.count()) ? await found.boundingBox() : null
    // Above the screen, never covering it.
    if (screenBox) expect(screenBox.y, `${path}: screen starts below the banner`).toBeGreaterThanOrEqual(box.y + box.height - 1)
  }

  // The Search & Ask drawer opens over a screen: the banner stays.
  await page.goto('/')
  await page.getByTestId('header-search-ask').click()
  await expect(page.getByTestId('search-ask')).toBeVisible()
  await expect(page.getByTestId('demo-banner')).toBeVisible()
  await page.keyboard.press('Escape')

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
  await page.getByTestId('demo-banner-switch-back').click()
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

test('the store swapping under an open Add friend sheet drops the sheet and writes nothing to either database', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.getByTestId('people-add-friend').click()
  await expect(page.getByTestId('screen-add-friend')).toBeVisible()
  await page.getByTestId('add-friend-contact').fill('zed.mid.swap@example.com')

  // On: the first seeding covers the app with a blocking dialog, then the sheet is gone and People is showing.
  const on = page.evaluate(() => (window as unknown as {__splitoTest: {demoMode(on: boolean): Promise<void>}}).__splitoTest.demoMode(true))
  await expect(page.getByTestId('demo-busy')).toBeVisible()
  await on
  await expect(page.getByTestId('demo-busy')).toHaveCount(0)
  await expect(page.getByTestId('screen-add-friend')).toHaveCount(0)
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByTestId('demo-banner')).toBeVisible()
  const inDemo = await page.evaluate(async () => JSON.stringify(await (window as unknown as {splito: {list(t: string): Promise<unknown[]>}}).splito.list('friendRequest')))
  expect(inDemo).not.toContain('zed.mid.swap')

  // Off again, with another sheet open on the demo side: the same, the other way round.
  await page.getByTestId('people-add-friend').click()
  await page.getByTestId('add-friend-contact').fill('zed.back@example.com')
  await closeDemo(page)
  await expect(page.getByTestId('screen-add-friend')).toHaveCount(0)
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await page.waitForFunction(() => 'splito' in window)
  const real = await page.evaluate(async () => JSON.stringify(await (window as unknown as {splito: {list(t: string): Promise<unknown[]>}}).splito.list('friendRequest')))
  expect(real).not.toContain('zed')
})

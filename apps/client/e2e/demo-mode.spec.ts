import {expect, type Page, test} from '@playwright/test'

import {closeDemo, openDemo, showSettled} from './openDemo'

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
  await page.goto('/')
  await expect(page.getByTestId('people-empty')).toBeVisible()
})

test('turning it on seeds the demo database in under 10 s, shows "Demo" on the avatar, and a reload keeps the mode', async ({page}) => {
  await page.goto('/settings')
  await expect(page.getByTestId('settings-demo-mode')).toBeVisible()
  const started = Date.now()
  await page.getByTestId('settings-demo-mode').click()
  await expect(page.getByTestId('header-avatar').last()).toHaveAttribute('aria-label', /Demo$/, {timeout: 30_000})
  const ms = Date.now() - started
  console.log(`demo mode on in ${ms} ms`)
  expect(ms).toBeLessThan(10_000)
  // The switch takes the app to the first tab: what was open belonged to the other database.
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByTestId('header-avatar').last()).toHaveAttribute('aria-label', /Demo$/)
  await expect(page.getByTestId('header-avatar').last().getByTestId('sync-dot-demo')).toBeAttached()
  await page.goto('/settings')
  // There is no Reset demo row (owner 136): off then on is the reset.
  await expect(page.getByTestId('settings-demo-reset')).toHaveCount(0)

  // Owner 133: no banner on any screen; the switch and the avatar's Demo dot are the only signs.
  for (const path of ['/', '/groups', '/activity', '/analytics', '/settings', '/expense/new', '/friends/new', '/groups/new', '/invites', '/signin']) {
    await page.goto(path)
    await expect(page.getByTestId('demo-banner'), `${path}: no banner`).toHaveCount(0)
    await expect(page.getByText('Demo mode ·')).toHaveCount(0)
  }

  // A year of activity: a page at a time, the next on scroll.
  await showSettled(page)
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
  await expect(page.getByTestId('header-avatar').last()).toHaveAttribute('aria-label', /Demo$/, {timeout: 30_000})
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

  // Switch back with the Settings switch: Home, with the real data and none of the demo.
  await page.goto('/settings')
  await page.getByTestId('settings-demo-mode').click()
  await expect(page).toHaveURL(/\/$/)
  // The demo database is erased behind the blocking cover: let it finish before anything reloads the page.
  await expect(page.getByTestId('demo-busy')).toHaveCount(0)
  await expect(page.getByTestId('person-Real Asha').last()).toBeVisible()
  await expect(page.getByTestId('person-Riya Sharma')).toHaveCount(0)
  const realAfter = await names(page, 'person')
  expect(realAfter.sort()).toEqual(realBefore.sort())
  await expect(page.getByTestId('header-avatar').last()).not.toHaveAttribute('aria-label', /Demo$/)
  // The switch is off again and a reload stays on the real data.
  await page.reload()
  await expect(page.getByTestId('person-Real Asha').last()).toBeVisible()

  // Back on: a fresh dataset, the edit made in the first session is gone (owner 136).
  await openDemo(page)
  expect(await names(page, 'person')).toContain('Riya Sharma')
  expect(await names(page, 'person')).not.toContain('Typed in demo')
  await closeDemo(page)
  expect(await names(page, 'person')).toContain('Real Asha')
})

const databases = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map(d => d.name))

test('turning demo mode off erases the demo database and every key it kept; turning it on again seeds afresh (owner 136)', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  expect(await databases(page)).not.toContain('splito-demo')

  await openDemo(page)
  expect(await databases(page)).toContain('splito-demo')
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.createPerson('Gone after off'))
  // A device key demo mode kept: a recent search lives under the demo scope.
  await page.getByTestId('header-search-ask').click()
  await page.getByTestId('search-input').fill('gonesearch')
  await page.getByTestId('search-input').press('Enter')
  await page.getByTestId('search-input').fill('')
  await expect(page.getByTestId('search-recent-gonesearch')).toBeVisible()
  await page.keyboard.press('Escape')

  await closeDemo(page)
  await expect.poll(() => databases(page)).not.toContain('splito-demo')
  // The real database is still there.
  expect(await databases(page)).toContain('splito')

  await openDemo(page)
  expect(await databases(page)).toContain('splito-demo')
  const again = await names(page, 'person')
  expect(again).toContain('Riya Sharma')
  expect(again).not.toContain('Gone after off')
  await page.getByTestId('header-search-ask').click()
  await expect(page.getByTestId('search-tips')).toBeVisible()
  await expect(page.getByTestId('search-recent-gonesearch')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await closeDemo(page)
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
  await expect(page.getByTestId('header-avatar').last()).toHaveAttribute('aria-label', /Demo$/)
  const inDemo = await page.evaluate(async () => JSON.stringify(await (window as unknown as {splito: {list(t: string): Promise<unknown[]>}}).splito.list('friendRequest')))
  expect(inDemo).not.toContain('zed.mid.swap')

  // Off again, with another sheet open on the demo side: the same, the other way round.
  await page.getByTestId('people-add-friend').click()
  await page.getByTestId('add-friend-contact').fill('zed.back@example.com')
  await closeDemo(page)
  await expect(page.getByTestId('screen-add-friend')).toHaveCount(0)
  await page.waitForFunction(() => 'splito' in window)
  const real = await page.evaluate(async () => JSON.stringify(await (window as unknown as {splito: {list(t: string): Promise<unknown[]>}}).splito.list('friendRequest')))
  expect(real).not.toContain('zed')
})

for (const [name, size] of [['1440 px', {width: 1440, height: 900}], ['390 px', {width: 390, height: 844}]] as const) {
  test(`demo mode draws no banner and leaves the Home header where it was, at ${name} (owner 133)`, async ({page}) => {
    await page.setViewportSize(size)
    await page.goto('/')
    await expect(page.getByTestId('screen-people')).toBeVisible()
    const top = async () => (await page.getByTestId('header-avatar').last().boundingBox())!.y
    const before = await top()
    await openDemo(page)
    await expect(page.getByTestId('screen-people')).toBeVisible()
    await expect(page.getByTestId('demo-banner')).toHaveCount(0)
    await expect(page.getByText('Switch back')).toHaveCount(0)
    expect(Math.abs((await top()) - before)).toBeLessThanOrEqual(2)
    // Switching back is the Settings switch.
    await page.goto('/settings')
    await expect(page.getByTestId('settings-demo-mode')).toBeVisible()
  })
}

test('with demo mode on every header title ends in " - Demo" (and the window title); off, there is no suffix (owner 134)', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto('/')
  await expect(page.getByText('Home', {exact: true}).first()).toBeVisible()
  await expect(page.getByText('Home - Demo', {exact: true})).toHaveCount(0)
  await expect(page).not.toHaveTitle(/Demo/)
  await openDemo(page)
  await expect(page.getByText('Home - Demo', {exact: true}).first()).toBeVisible()
  await expect(page).toHaveTitle('Home - Demo - Splito')
  for (const [path, title] of [['/groups', 'Groups - Demo'], ['/settings', 'Settings - Demo']] as const) {
    await page.goto(path)
    await expect(page.getByText(title, {exact: true}).first()).toBeVisible()
    await expect(page).toHaveTitle(`${title} - Splito`)
  }
  // Phones show the logo on Home, so the title slot gets a small "Demo" label beside it.
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')
  await expect(page.getByTestId('header-demo-label')).toHaveText('Demo')
  await closeDemo(page)
  await expect(page.getByTestId('header-demo-label')).toHaveCount(0)
})

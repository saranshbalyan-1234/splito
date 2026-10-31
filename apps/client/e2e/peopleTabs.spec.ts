import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-256, F-271 (owners 153, 198, 206; ARCHITECTURE 26.3): there is no Home. The app opens on People (the start tab);
 * People holds requests, invites and the Friends list; the Overview is the top of Analytics (overviewLayout.spec.ts);
 * the nav lists People, Groups, Analytics, Activity, Settings on the bar, rail and desktop.
 */

const PHONE = {width: 390, height: 844}
const RAIL = {width: 900, height: 800}
const DESKTOP = {width: 1440, height: 900}

type Splito = {putRawPref(key: string, value: unknown): Promise<void>}

/** A link the running app opens (a notification, a share, a Search & Ask result): a main screen then opens as a pushed copy (owner 179). */
const openLink = (page: Page, path: string) =>
  page.evaluate(p => (window as unknown as {__splitoTest: {openLink(path: string): void}}).__splitoTest.openLink(p), path)

const ids = (page: Page, scope = 'navigation') =>
  page
    .getByRole(scope as 'navigation')
    .locator('[data-testid^="tab-"]:not([data-testid="tab-label"])')
    .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))


test('the app opens on People: / is the start tab, there is no Home anywhere, the logo goes to the start tab (owner 198)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page).toHaveURL(/\/people$/)
  for (const id of ['screen-home', 'tab-home', 'drawer-home', 'home-overview', 'home-recent-transactions', 'home-recent-people', 'home-recent-groups'])
    await expect(page.getByTestId(id)).toHaveCount(0)
  // The old Home address redirects: / is the start tab, /?overview= is the Overview at the top of Analytics.
  await page.goto('/')
  await expect(page).toHaveURL(/\/people$/)
  await page.goto('/?overview=groups')
  await expect(page).toHaveURL(/\/analytics\?overview=groups$/)
  await expect(page.getByTestId('screen-analytics').getByTestId('analytics-currency')).toBeVisible()
  await expect(page.getByTestId('screen-analytics').getByTestId('overview')).toHaveCount(0)
  // The logo goes to the start tab.
  await page.setViewportSize(DESKTOP)
  await page.getByTestId('tab-activity').click()
  await expect(page.getByTestId('screen-activity')).toBeVisible()
  await page.getByTestId('logo').click()
  await expect(page).toHaveURL(/\/people$/)
  await expect(page.getByTestId('screen-people')).toBeVisible()
})

test('People tab: requests, invites row, Friends with search, Filters, Sort and Show settled; no Overview', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/people')
  const people = page.getByTestId('screen-people')
  await expect(people.getByTestId('people-requests-title')).toBeVisible()
  await expect(people.getByTestId('people-invites-title')).toBeVisible()
  await expect(people.getByTestId('invite-sent-Kabir')).toBeVisible()
  await expect(people.getByTestId('people-friends-title')).toBeVisible()
  await expect(people.getByTestId('list-search')).toBeVisible()
  await expect(people.getByTestId('list-filters')).toBeVisible()
  // Friends header, left to right: search, Filters, Sort (owner 199), then the Manage gear last (owner 177); no "Manage" text.
  const [search, filters, sort, gear] = await Promise.all(['list-search', 'list-filters', 'list-sort', 'people-manage-friends'].map(id => people.getByTestId(id).boundingBox()))
  expect(search!.x).toBeLessThan(filters!.x)
  expect(filters!.x).toBeLessThan(sort!.x)
  expect(sort!.x).toBeLessThan(gear!.x)
  expect(Math.abs(search!.y - gear!.y)).toBeLessThan(2)
  expect(Math.abs(search!.width - gear!.width)).toBeLessThan(2)
  await expect(people.getByTestId('people-manage-friends')).toHaveAttribute('aria-label', 'Manage friends and invites')
  await expect(people.getByTestId('people-manage-friends')).toHaveText('')
  // People has its own Overview of balances with friends (owner 219).
  await expect(people.getByTestId('people-overview')).toBeVisible()
  await expect(people.getByTestId('people-add-friend')).toBeVisible()
  await expect(people.getByTestId('header-search-ask')).toBeVisible()
  await expect(people.getByTestId('fab-add')).toBeVisible()
  await people.getByTestId('people-manage-friends').click()
  await expect(page).toHaveURL(/\/settings\/friends$/)
  await page.goBack()
  await people.getByTestId('list-filters').click()
  await expect(page.getByTestId('filter-settled-toggle')).toBeVisible()
  // Sort is not in the Filters sheet any more (owner 199): it is its own button.
  await expect(page.getByTestId('filter-sort-name')).toHaveCount(0)
  await page.getByTestId('sheet-close').click()
  // A friend still opens /people/:id.
  await people.getByTestId('person-Riya Sharma').click()
  await expect(page).toHaveURL(/\/people\/[^/]+$/)
  await expect(page.getByTestId('screen-person')).toBeVisible()
})

test('Groups has its own Overview of balances in groups, above the list (owner 219)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('groups-list-title')).toBeVisible()
  await expect(groups.getByTestId('groups-balances')).toHaveCount(0)
  await expect(groups.getByTestId('groups-overview')).toBeVisible()
  expect((await groups.getByTestId('groups-overview').boundingBox())!.y).toBeLessThan((await groups.getByTestId('groups-list-title').boundingBox())!.y)
  // Groups has the same header as People: search, Filters, Sort.
  await expect(groups.getByTestId('list-filters')).toBeVisible()
  await expect(groups.getByTestId('list-sort')).toBeVisible()
  await expect(groups.getByTestId('list-search')).toBeVisible()
})

test('navigation: phone bar, rail and desktop lists, in order', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await expect(page.getByTestId('tab-people')).toBeVisible()
  expect(await ids(page)).toEqual(['tab-people', 'tab-groups', 'tab-analytics', 'tab-activity'])
  // Four tabs show their labels; Settings is in Profile, not a bar item (owner 220).
  await expect(page.getByTestId('tab-label')).toHaveCount(4)
  await expect(page.getByTestId('tab-people')).toContainText('People')
  await page.getByTestId('tab-people').click()
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page).toHaveURL(/\/people$/)

  const everyItem = ['tab-people', 'tab-groups', 'tab-analytics', 'tab-activity']
  for (const size of [RAIL, DESKTOP]) {
    await page.setViewportSize(size)
    await expect.poll(() => ids(page)).toEqual(everyItem)
    await expect(page.getByTestId('tab-more')).toHaveCount(0)
  }
  await expect(page.getByTestId('tab-people')).toContainText('People')
  await expect(page.getByTestId('tab-people')).toHaveAttribute('aria-current', 'page')
  await page.getByTestId('tab-groups').click()
  await expect(page).toHaveURL(/\/groups$/)
  await expect(page.getByTestId('tab-groups')).toHaveAttribute('aria-current', 'page')
  // Back on a phone the bar is at the bottom again and is the only navigation (no drawer, owner 217).
  await page.setViewportSize(PHONE)
  await expect.poll(async () => (await page.getByRole('navigation').boundingBox())?.y ?? 0).toBeGreaterThan(600)
  await expect.poll(() => ids(page)).toEqual(everyItem)
  await expect(page.getByTestId('drawer')).toHaveCount(0)
})

test('a saved bar naming home, ask or settings loses them and keeps its order, with People; the old default bars become the new one (owners 198, 200, 220)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.putRawPref('tabs', ['home', 'people', 'activity', 'ask', 'groups']))
  // A bar that held Home keeps People; Settings is no bar item (owner 220).
  await expect.poll(() => ids(page)).toEqual(['tab-people', 'tab-activity', 'tab-groups'])
  await page.reload()
  await expect.poll(() => ids(page)).toEqual(['tab-people', 'tab-activity', 'tab-groups'])
  await expect(page.getByTestId('screen-people')).toBeVisible()
  // A bar that is exactly the old default, or the one with Settings (owner 206), was never customised: it reads as the four.
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.putRawPref('tabs', ['home', 'people', 'groups', 'analytics', 'activity']))
  await expect.poll(() => ids(page)).toEqual(['tab-people', 'tab-groups', 'tab-analytics', 'tab-activity'])
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.putRawPref('tabs', ['people', 'groups', 'analytics', 'activity', 'settings']))
  await expect.poll(() => ids(page)).toEqual(['tab-people', 'tab-groups', 'tab-analytics', 'tab-activity'])
})

test('the right column shows on every page at 1440, People included (there is no Home to leave it out of)', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page)
  await expect(page.getByTestId('screen-people')).toBeVisible()
  for (const tab of ['tab-people', 'tab-groups', 'tab-analytics', 'tab-activity']) {
    await page.getByTestId(tab).click()
    await expect(page.getByTestId('right-nav')).toBeVisible()
  }
})

test('deep links: / is the start tab, /people is People with list state, /people/filters opens its sheet', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await page.goto('/people?sort=name&show=owesYou')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByTestId('people-friends-title')).toBeVisible()
  await expect(page).toHaveURL(/\/people\?show=owesYou&sort=name$|\/people\?sort=name&show=owesYou$/)
  await page.goto('/people/filters')
  await expect(page.getByTestId('friends-filters-sheet')).toBeVisible()
})

test('no horizontal overflow on People, Groups and Analytics at 320 and 390', async ({page}) => {
  await openDemo(page)
  for (const width of [320, 390]) {
    await page.setViewportSize({width, height: 800})
    for (const [path, screen] of [['/people', 'screen-people'], ['/groups', 'screen-groups'], ['/analytics', 'screen-analytics']]) {
      await page.goto(path!)
      await expect(page.getByTestId(screen!)).toBeVisible()
      await page.waitForTimeout(800)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(over, `${path} @${width}`).toBeLessThanOrEqual(0)
    }
  }
})

test('a main screen opened from a link is its tab with Back in place of the avatar: same FAB, same header actions (owners 179, 190)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  const start = page.getByTestId('screen-people')
  await expect(start.getByTestId('header-avatar')).toBeVisible()
  await openLink(page, '/groups')
  await expect(page).toHaveURL(/\/groups\?from=people$/)
  const groups = page.getByTestId('screen-groups').last()
  await expect(groups.getByTestId('header-back')).toBeVisible()
  await expect(groups.getByTestId('header-avatar')).toHaveCount(0)
  // Same as the tab: the FAB and every header action (Create group; Search & Ask is the start tab's only, owner 218), the list's Filters.
  await expect(groups.getByTestId('fab-add')).toBeVisible()
  await expect(groups.getByTestId('header-search-ask')).toHaveCount(0)
  await expect(groups.getByTestId('groups-new')).toBeVisible()
  await expect(groups.getByTestId('list-filters')).toBeVisible()
  // Back returns to where the link was pressed.
  await groups.getByTestId('header-back').click()
  await expect(page).toHaveURL(/\/people$/)
  await expect(page.getByTestId('screen-people').getByTestId('header-avatar')).toBeVisible()
  // The Groups tab itself is the plain tab screen: the avatar and the FAB.
  await page.getByTestId('tab-groups').click()
  await expect(page).toHaveURL(/\/groups$/)
  const tab = page.getByTestId('screen-groups').last()
  await expect(tab.getByTestId('header-avatar')).toBeVisible()
  await expect(tab.getByTestId('header-back')).toHaveCount(0)
  await expect(tab.getByTestId('fab-add')).toBeVisible()
  // Differs only by Back: the tab has the same actions.
  await expect(tab.getByTestId('header-search-ask')).toHaveCount(0)
  await expect(tab.getByTestId('groups-new')).toBeVisible()
  await expect(tab.getByTestId('list-filters')).toBeVisible()
  // The other links: Analytics, then People opened from Groups.
  await page.getByTestId('tab-people').click()
  await expect(page).toHaveURL(/\/people$/)
  await openLink(page, '/analytics')
  await expect(page.getByTestId('screen-analytics').last().getByTestId('header-back')).toBeVisible()
  await page.getByTestId('screen-analytics').last().getByTestId('header-back').click()
  await expect(page).toHaveURL(/\/people$/)
  await page.getByTestId('tab-groups').click()
  await expect(page).toHaveURL(/\/groups$/)
  await openLink(page, '/people')
  const people = page.getByTestId('screen-people').last()
  await expect(people.getByTestId('header-back')).toBeVisible()
  // People keeps the FAB and every header action of its tab: Search & Ask, Add friend, and the Friends row's search, Filters, Sort and gear.
  await expect(people.getByTestId('fab-add')).toBeVisible()
  for (const id of ['header-search-ask', 'people-add-friend', 'list-search', 'list-filters', 'list-sort', 'people-manage-friends']) await expect(people.getByTestId(id)).toBeVisible()
})

test('the FAB on a Person and a Group page pre-selects that friend or group; Settings has none (owner 190)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  const ids = await page.evaluate(async () => {
    const s = (window as unknown as {splito: {me: string; list(t: string): Promise<{id: string}[]>}}).splito
    return {person: (await s.list('person')).find(p => p.id !== s.me)!.id, group: (await s.list('group'))[0]!.id}
  })
  await page.goto(`/people/${ids.person}`)
  await expect(page.getByTestId('screen-person').getByTestId('fab-add')).toBeVisible()
  await page.getByTestId('screen-person').getByTestId('fab-add').click()
  await expect(page).toHaveURL(new RegExp(`/expense/new\\?personId=${ids.person}`))
  await page.goto(`/groups/${ids.group}`)
  await expect(page.getByTestId('screen-group').getByTestId('fab-add')).toBeVisible()
  await page.getByTestId('screen-group').getByTestId('fab-add').click()
  await expect(page).toHaveURL(new RegExp(`/expense/new\\?groupId=${ids.group}`))
  // Where adding an expense makes no sense there is none.
  for (const [path, screen] of [['/settings/appearance', 'screen-settings-section'], ['/profile', 'screen-profile']] as const) {
    await page.goto(path)
    await expect(page.getByTestId(screen)).toBeVisible()
    await expect(page.getByTestId('fab-add')).toHaveCount(0)
  }
  // Wide screens have no FAB anywhere; Group and Person keep their body button.
  await page.setViewportSize(DESKTOP)
  await page.goto(`/groups/${ids.group}`)
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await expect(page.getByTestId('fab-add')).toHaveCount(0)
  await expect(page.getByTestId('group-add-expense')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByTestId('fab-add')).toHaveCount(0)
})

for (const [name, size, bar] of [['390', PHONE, 'tab-groups'], ['1440', DESKTOP, 'tab-groups']] as const) {
  test(`pressing a tab while on its own pushed copy gives the plain tab at ${name} (owner 179)`, async ({page}) => {
    await page.setViewportSize(size)
    await openDemo(page)
    await openLink(page, '/groups')
    const copy = page.getByTestId('screen-groups').last()
    await expect(copy.getByTestId('header-back')).toBeVisible()
    // The tab's own press is not a no-op on the copy: it becomes the plain tab, with the avatar and no Back.
    await page.getByTestId(bar).click()
    const plain = page.getByTestId('screen-groups').last()
    await expect(plain.getByTestId('header-avatar')).toBeVisible()
    await expect(plain.getByTestId('header-back')).toHaveCount(0)
    await expect(page).toHaveURL(/\/groups$/)
    if (size.width < 800) await expect(plain.getByTestId('fab-add')).toBeVisible()
    // And the tab press on the plain tab changes nothing.
    await page.getByTestId(bar).click()
    await expect(plain.getByTestId('header-avatar')).toBeVisible()
  })
}

test('a link the running app opens (a Search & Ask suggestion, a deep link) to a main screen is a pushed copy; a cold address is the plain tab (owner 179)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  // Warm: openLink, the one function behind notifications, shares, results and deep links.
  await page.evaluate(() => (window as unknown as {__splitoTest: {openLink(path: string): void}}).__splitoTest.openLink('/groups'))
  const warm = page.getByTestId('screen-groups').last()
  await expect(warm.getByTestId('header-back')).toBeVisible()
  await expect(warm.getByTestId('fab-add')).toBeVisible()
  await warm.getByTestId('header-back').click()
  await expect(page.getByTestId('screen-people').getByTestId('header-avatar')).toBeVisible()
  // Cold: the same address typed into the browser is the plain tab.
  await page.goto('/groups')
  const cold = page.getByTestId('screen-groups').last()
  await expect(cold.getByTestId('header-avatar')).toBeVisible()
  await expect(cold.getByTestId('header-back')).toHaveCount(0)
})

/* Owner 184 (F-263): every page has a fixed parent. Refreshed or pasted, Back goes to it, and a second Back keeps climbing. */
const TAB_SCREENS = ['screen-people', 'screen-groups', 'screen-analytics', 'screen-activity']
/* From `from`, one Back per screen: the header's Back where the page has one, the browser's where it is a main tab (a tab shows the avatar). */
async function backUp(page: Page, from: string, screens: string[]) {
  let leaving = from
  for (const screen of screens) {
    if (TAB_SCREENS.includes(leaving) && !(await page.getByTestId(leaving).last().getByTestId('header-back').count())) await page.goBack()
    else await page.getByTestId('header-back').last().click()
    await expect(page.getByTestId(screen).last()).toBeVisible()
    leaving = screen
  }
}

test('refreshed or pasted, Back climbs to the fixed parent and on to the start tab, People (owners 184, 198)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  const ids = await page.evaluate(async () => {
    const s = (window as unknown as {splito: {me: string; list(t: string): Promise<{id: string; data: {groupId?: string | null; payers?: Record<string, string>; shares?: Record<string, string>}}[]>}}).splito
    const expenses = await s.list('expense')
    const others = (e: (typeof expenses)[number]) => [...new Set([...Object.keys(e.data.payers ?? {}), ...Object.keys(e.data.shares ?? {})])].filter(id => id !== s.me)
    return {
      person: (await s.list('person')).find(p => p.id !== s.me)!.id,
      group: (await s.list('group'))[0]!.id,
      groupExpense: expenses.find(e => e.data.groupId)!.id,
      directExpense: expenses.find(e => !e.data.groupId && others(e).length === 1)!.id,
    }
  })
  // Settings > Appearance: Profile (which holds Settings, owner 220), then the start tab.
  await page.goto('/settings/appearance')
  await expect(page.getByTestId('screen-settings-section')).toBeVisible()
  await backUp(page, 'screen-settings-section', ['screen-profile', 'screen-people'])
  // A friend: People is the start tab, so one Back.
  await page.goto(`/people/${ids.person}`)
  await expect(page.getByTestId('screen-person')).toBeVisible()
  await backUp(page, 'screen-person', ['screen-people'])
  // A group: Groups, then the start tab.
  await page.goto(`/groups/${ids.group}`)
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await backUp(page, 'screen-group', ['screen-groups', 'screen-people'])
  // An expense in a group: that group, Groups, the start tab.
  await page.goto(`/expense/${ids.groupExpense}`)
  await expect(page.getByTestId('screen-expense')).toBeVisible()
  await expect(page.getByTestId('expense-detail-title')).toBeVisible()
  await backUp(page, 'screen-expense', ['screen-group', 'screen-groups', 'screen-people'])
  // An expense with one friend and no group: that friend, then People (the start tab).
  await page.goto(`/expense/${ids.directExpense}`)
  await expect(page.getByTestId('expense-detail-title')).toBeVisible()
  await backUp(page, 'screen-expense', ['screen-person', 'screen-people'])
  // Profile is its own page: Back goes to the start tab (owner 206). Friends and invites: People.
  await page.goto('/profile')
  await backUp(page, 'screen-profile', ['screen-people'])
  await page.goto('/settings/friends')
  await backUp(page, 'screen-friends-invites', ['screen-people'])
})

test('a pushed Activity copy keeps its Back after a refresh, and tapping the tab drops it (owner 179, 184)', async ({page}) => {
  for (const size of [PHONE, DESKTOP]) {
    await page.setViewportSize(size)
    await openDemo(page)
    await openLink(page, '/activity?tab=all&type=transactions')
    await expect(page).toHaveURL(/\/activity\/all\?from=people&type=transactions$/)
    await expect(page.getByTestId('screen-activity').last().getByTestId('header-back')).toBeVisible()
    await page.reload()
    const copy = page.getByTestId('screen-activity').last()
    await expect(copy.getByTestId('header-back')).toBeVisible()
    await expect(copy.getByTestId('header-avatar')).toHaveCount(0)
    await backUp(page, 'screen-activity', ['screen-people'])
    // The tab itself is the plain tab, and its address has no from.
    await page.getByTestId('tab-activity').click()
    await expect(page).toHaveURL(/\/activity$/)
    await expect(page.getByTestId('screen-activity').last().getByTestId('header-avatar')).toBeVisible()
  }
})

/* Owner 199 (F-272): Sort is its own button beside Filters on People and Groups; the order is in the address and remembered. */
for (const [label, size] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  for (const [name, path, screen, rows] of [
    ['People', '/people', 'screen-people', 'a[data-testid^="person-"]'],
    ['Groups', '/groups', 'screen-groups', '[data-testid^="group-"][href]'],
  ] as const) {
    test(`${name} Sort at ${label}: Last active by default, a pick reorders the list, the address keeps it and a reload too`, async ({page}) => {
      await page.setViewportSize(size)
      await openDemo(page, path)
      const list = page.getByTestId(screen)
      const names = async () => (await list.locator(rows).evaluateAll(els => els.map(e => e.getAttribute('data-testid')!))).slice(0, 8)
      await expect(list.locator(rows).first()).toBeVisible()
      const sort = list.getByTestId('list-sort')
      await expect(sort).toHaveAttribute('aria-label', 'Sort')
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      const byActivity = await names()

      await sort.click()
      for (const id of ['lastActive', 'name', 'amount', 'newest']) await expect(page.getByTestId(`list-sort-${id}`)).toBeVisible()
      await expect(page.getByTestId('list-sort-lastActive')).toHaveAttribute('aria-checked', 'true')
      await page.getByTestId('list-sort-name').click()
      await expect(page).toHaveURL(new RegExp(`${path}\\?sort=name$`))
      await expect(sort).toHaveAttribute('aria-label', 'Sort, by Name')
      await expect.poll(async () => (await names()).join('|')).toBe([...(await names())].sort((x, y) => x.localeCompare(y)).join('|'))
      expect(await names()).not.toEqual(byActivity)
      // It is not a filter: the Filters dot stays off.
      await expect(list.getByTestId('list-filters-dot')).toHaveCount(0)

      const byName = await names()
      await page.reload()
      await expect(page).toHaveURL(new RegExp(`${path}\\?sort=name$`))
      await expect(page.getByTestId(screen).getByTestId('list-sort')).toHaveAttribute('aria-label', 'Sort, by Name')
      await expect.poll(names).toEqual(byName)

      await page.getByTestId(screen).getByTestId('list-sort').click()
      await expect(page.getByTestId('list-sort-name')).toHaveAttribute('aria-checked', 'true')
      await page.getByTestId('list-sort-newest').click()
      await expect(page).toHaveURL(new RegExp(`${path}\\?sort=newest$`))
      await page.getByTestId(screen).getByTestId('list-sort').click()
      await page.getByTestId('list-sort-amount').click()
      await expect(page).toHaveURL(new RegExp(`${path}\\?sort=amount$`))
      // Back to the default: the param goes, and the order is the first one again.
      await page.getByTestId(screen).getByTestId('list-sort').click()
      await page.getByTestId('list-sort-lastActive').click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByTestId(screen).getByTestId('list-sort')).toHaveAttribute('aria-label', 'Sort')
      await expect.poll(names).toEqual(byActivity)
    })
  }
}

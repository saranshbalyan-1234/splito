import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-256 (owners 153-161, ARCHITECTURE 26.3 and 26.12): Home, People and Groups are three tabs and the Overview lives only
 * on Home. Home reads Overview, Requests, Recent transactions, Recently active people, Recently active groups, each at
 * most 5 rows; People holds requests, invites and the Friends list; the nav lists every item on rail and desktop.
 */

const PHONE = {width: 390, height: 844}
const RAIL = {width: 900, height: 800}
const DESKTOP = {width: 1440, height: 900}

type Splito = {putRawPref(key: string, value: unknown): Promise<void>}

const ids = (page: Page, scope = 'navigation') =>
  page
    .getByRole(scope as 'navigation')
    .locator('[data-testid^="tab-"]:not([data-testid="tab-label"])')
    .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))

const y = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!.y

test('Home at 390: the sections in order, each at most 5 rows, no friends list, header holds Search & Ask only', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  const home = page.getByTestId('screen-home')
  await expect(home.getByTestId('home-overview')).toBeVisible()
  const order = ['home-overview-title', 'people-requests-title', 'people-invites-title', 'home-recent-transactions-title', 'home-recent-people-title', 'home-recent-groups-title']
  const ys: number[] = []
  for (const id of order) ys.push(await y(page, id))
  expect([...ys].sort((p, q) => p - q)).toEqual(ys)

  const rows = (section: string, selector: string) => home.getByTestId(section).locator(selector)
  const transactions = await rows('home-recent-transactions', 'a[data-testid^="home-transaction-"]').count()
  const people = await rows('home-recent-people', 'a[data-testid^="person-"]').count()
  const groups = await rows('home-recent-groups', 'a[data-testid^="group-"]').count()
  for (const n of [transactions, people, groups]) {
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(5)
  }
  expect(await home.getByTestId('people-requests').locator('[data-testid^="request-"][data-testid*=" "]').count()).toBeLessThanOrEqual(5)

  await expect(home.getByTestId('people-friends-title')).toHaveCount(0)
  await expect(home.getByTestId('list-filters')).toHaveCount(0)
  await expect(home.getByTestId('header-search-ask')).toBeVisible()
  await expect(home.getByTestId('people-add-friend')).toHaveCount(0)
  // The See all links go where they say.
  await expect(home.getByTestId('home-recent-transactions-all')).toHaveAttribute('href', '/activity?type=transactions')
  await expect(home.getByTestId('home-recent-people-all')).toHaveAttribute('href', '/people')
  await expect(home.getByTestId('home-recent-groups-all')).toHaveAttribute('href', '/groups')
  await home.getByTestId('home-recent-people-all').click()
  // Opened from a link: the address keeps where it came from, so a refresh keeps Back (owner 184).
  await expect(page).toHaveURL(/\/people\?from=home$/)
  await expect(page.getByTestId('screen-people')).toBeVisible()
})

test('Overview cards at 390: compact, the net alone is coloured and on the right, the breakdown is plain text on the left', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await expect(page.getByTestId('home-overview')).toBeVisible()
  const cards = await page.getByTestId('home-overview').evaluate(root => {
    const sat = (c: string) => {
      const m = c.match(/\d+(\.\d+)?/g)!.map(Number)
      return Math.max(m[0]!, m[1]!, m[2]!) - Math.min(m[0]!, m[1]!, m[2]!)
    }
    return [...root.querySelectorAll<HTMLElement>('[data-testid$="-card"]')].map(card => {
      const code = card.dataset.testid!.split('-')[1]!
      const box = card.getBoundingClientRect()
      const q = (id: string) => card.querySelector<HTMLElement>(`[data-testid="${id}"]`)
      const label = q(`summary-${code}-label`)!.getBoundingClientRect()
      const net = q(`summary-${code}-net`)!
      const netBox = net.getBoundingClientRect()
      const owed = q(`summary-${code}-owed`)
      const owe = q(`summary-${code}-owe`)
      // Every text leaf but the net: grey (no green or red) ones only.
      const leaves = [...card.querySelectorAll<HTMLElement>('*')].filter(e => e.childElementCount === 0 && e.textContent?.trim() && !net.contains(e) && e !== net)
      return {
        code,
        top: box.top,
        bottom: box.bottom,
        height: box.height,
        right: box.right,
        left: box.left,
        netRight: netBox.right,
        netLeft: netBox.left,
        labelLeft: label.left,
        netColour: getComputedStyle(net).color,
        netSaturation: sat(getComputedStyle(net).color),
        otherSaturation: Math.max(0, ...leaves.map(e => sat(getComputedStyle(e).color))),
        owedLeft: owed?.getBoundingClientRect().left ?? null,
        oweLeft: owe?.getBoundingClientRect().left ?? null,
      }
    })
  })
  expect(cards.length).toBeGreaterThanOrEqual(6)
  for (const c of cards) {
    // About 64-96 px; a card with both directions open is the tall one.
    expect(c.height, c.code).toBeGreaterThanOrEqual(58)
    expect(c.height, c.code).toBeLessThanOrEqual(100)
    // The net sits on the right: its right edge keeps the card's inner padding, the same inset the label keeps on the left.
    expect(Math.abs(c.right - c.netRight - (c.labelLeft - c.left)), c.code).toBeLessThanOrEqual(3)
    expect(c.netLeft, c.code).toBeGreaterThan(c.labelLeft + 60)
    // The net is the only coloured figure.
    expect(c.netSaturation, c.code).toBeGreaterThan(60)
    expect(c.otherSaturation, c.code).toBeLessThanOrEqual(45)
    // The breakdown lines are on the left, under the label.
    if (c.owedLeft !== null) {
      expect(Math.abs(c.owedLeft - c.labelLeft), c.code).toBeLessThanOrEqual(2)
      expect(Math.abs(c.oweLeft! - c.labelLeft), c.code).toBeLessThanOrEqual(2)
      expect(c.height, c.code).toBeGreaterThan(80)
    }
  }
  // Six currencies fit one phone screen with the header, the section title and the bottom bar.
  const barTop = (await page.getByTestId('tab-home').boundingBox())!.y
  expect(cards[5]!.bottom).toBeLessThanOrEqual(barTop)
  expect(cards[5]!.bottom).toBeLessThanOrEqual(PHONE.height)
})

test('People tab: requests, invites row, Friends with search, Filters and Show settled; no Overview', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/people')
  const people = page.getByTestId('screen-people')
  await expect(people.getByTestId('people-requests-title')).toBeVisible()
  await expect(people.getByTestId('people-invites-title')).toBeVisible()
  await expect(people.getByTestId('invite-sent-Kabir')).toBeVisible()
  await expect(people.getByTestId('people-friends-title')).toBeVisible()
  await expect(people.getByTestId('list-search')).toBeVisible()
  await expect(people.getByTestId('list-filters')).toBeVisible()
  // Friends header, right to left: search, Filters, then the Manage gear (owner 177); no "Manage" text.
  const [search, filters, gear] = await Promise.all(['list-search', 'list-filters', 'people-manage-friends'].map(id => people.getByTestId(id).boundingBox()))
  expect(search!.x).toBeLessThan(filters!.x)
  expect(filters!.x).toBeLessThan(gear!.x)
  expect(Math.abs(search!.y - gear!.y)).toBeLessThan(2)
  expect(Math.abs(search!.width - gear!.width)).toBeLessThan(2)
  await expect(people.getByTestId('people-manage-friends')).toHaveAttribute('aria-label', 'Manage friends and invites')
  await expect(people.getByTestId('people-manage-friends')).toHaveText('')
  await expect(people.getByTestId('home-overview')).toHaveCount(0)
  await expect(people.getByTestId('people-add-friend')).toBeVisible()
  await expect(people.getByTestId('header-search-ask')).toBeVisible()
  await expect(people.getByTestId('fab-add')).toBeVisible()
  await people.getByTestId('people-manage-friends').click()
  await expect(page).toHaveURL(/\/settings\/friends$/)
  await page.goBack()
  await people.getByTestId('list-filters').click()
  await expect(page.getByTestId('filter-settled-toggle')).toBeVisible()
  await page.getByTestId('sheet-close').click()
  // A friend still opens /people/:id.
  await people.getByTestId('person-Riya Sharma').click()
  await expect(page).toHaveURL(/\/people\/[^/]+$/)
  await expect(page.getByTestId('screen-person')).toBeVisible()
})

test('Groups has no Overview', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/groups')
  const groups = page.getByTestId('screen-groups')
  await expect(groups.getByTestId('groups-list-title')).toBeVisible()
  await expect(groups.getByTestId('groups-balances')).toHaveCount(0)
  await expect(groups.getByTestId('home-overview')).toHaveCount(0)
  await expect(groups.getByTestId('list-search')).toBeVisible()
})

test('navigation: phone bar, rail and desktop lists, in order', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await expect(page.getByTestId('tab-home')).toBeVisible()
  expect(await ids(page)).toEqual(['tab-home', 'tab-people', 'tab-groups', 'tab-analytics', 'tab-activity'])
  // Five tabs show their labels.
  await expect(page.getByTestId('tab-label')).toHaveCount(5)
  await expect(page.getByTestId('tab-people')).toContainText('People')
  await page.getByTestId('tab-people').click()
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page).toHaveURL(/\/people$/)

  const everyItem = ['tab-home', 'tab-people', 'tab-groups', 'tab-analytics', 'tab-activity', 'tab-ask', 'tab-settings']
  for (const size of [RAIL, DESKTOP]) {
    await page.setViewportSize(size)
    await expect.poll(() => ids(page)).toEqual(everyItem)
    await expect(page.getByTestId('tab-more')).toHaveCount(0)
  }
  await expect(page.getByTestId('tab-people')).toContainText('People')
  await expect(page.getByTestId('tab-people')).toHaveAttribute('aria-current', 'page')
  await page.getByTestId('tab-home').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page')
  // The drawer lists the same.
  await page.setViewportSize(PHONE)
  await page.getByTestId('screen-home').getByTestId('header-avatar').click()
  const rows = await page
    .getByTestId('drawer')
    .locator('[data-testid^="drawer-"]')
    .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(rows.slice(1, 8)).toEqual(['drawer-home', 'drawer-people', 'drawer-groups', 'drawer-analytics', 'drawer-activity', 'drawer-ask', 'drawer-settings'])
})

test('a saved bar from before the People tab gets People after Home, and keeps its own order', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.putRawPref('tabs', ['people', 'activity', 'groups']))
  await expect.poll(() => ids(page)).toEqual(['tab-home', 'tab-people', 'tab-activity', 'tab-groups'])
  await page.reload()
  await expect.poll(() => ids(page)).toEqual(['tab-home', 'tab-people', 'tab-activity', 'tab-groups'])
  await expect(page.getByTestId('screen-home')).toBeVisible()
})

test('the right column is not shown on Home at 1440, and other pages keep it', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page)
  await expect(page.getByTestId('home-overview')).toBeVisible()
  await expect(page.getByTestId('right-nav')).toHaveCount(0)
  // The content takes the room: sidebar on the left, the window's edge on the right.
  const box = (await page.getByTestId('screen-home').boundingBox())!
  expect(box.x + box.width).toBe(DESKTOP.width)
  for (const tab of ['tab-people', 'tab-groups', 'tab-activity']) {
    await page.getByTestId(tab).click()
    await expect(page.getByTestId('right-nav')).toBeVisible()
  }
  await page.getByTestId('tab-home').click()
  await expect(page.getByTestId('right-nav')).toHaveCount(0)
})

test('deep links: / is Home, /people is People with list state, /people/filters opens its sheet', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/')
  await expect(page.getByTestId('screen-home')).toBeVisible()
  await page.goto('/people?sort=name&show=owesYou')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByTestId('people-friends-title')).toBeVisible()
  await expect(page).toHaveURL(/\/people\?show=owesYou&sort=name$|\/people\?sort=name&show=owesYou$/)
  await page.goto('/people/filters')
  await expect(page.getByTestId('friends-filters-sheet')).toBeVisible()
})

test('no horizontal overflow on Home, People and Groups at 320 and 390', async ({page}) => {
  await openDemo(page)
  for (const width of [320, 390]) {
    await page.setViewportSize({width, height: 800})
    for (const [path, screen] of [['/', 'screen-home'], ['/people', 'screen-people'], ['/groups', 'screen-groups']]) {
      await page.goto(path!)
      await expect(page.getByTestId(screen!)).toBeVisible()
      await page.waitForTimeout(800)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(over, `${path} @${width}`).toBeLessThanOrEqual(0)
    }
  }
})

/** The signed net of each Overview card, by currency: "You owe" is negative. */
async function rawNets(page: Page) {
  const cards = page.getByTestId('home-overview').locator('[data-testid$="-card"]')
  return cards.evaluateAll(els =>
    Object.fromEntries(
      els.map(card => {
        const code = card.getAttribute('data-testid')!.split('-')[1]!
        const label = card.querySelector(`[data-testid="summary-${code}-label"]`)!.textContent!
        const figure = card.querySelector(`[data-testid="summary-${code}-net"]`)!.textContent!
        const n = Number(figure.replace(/[^0-9.]/g, ''))
        return [code, /owe\b/.test(label) ? -n : label.includes('settled') ? 0 : n]
      }),
    ) as Record<string, number>,
  )
}

/** The nets once the amounts have stopped counting to their new values. */
async function overviewNets(page: Page) {
  let last = JSON.stringify(await rawNets(page))
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250)
    const now = JSON.stringify(await rawNets(page))
    if (now === last) break
    last = now
  }
  return JSON.parse(last) as Record<string, number>
}

test('Overview scope: All, Groups and Direct change only the cards; it is in the address and remembered; Analytics carries it (owner 176)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  const home = page.getByTestId('screen-home')
  await expect(home.getByTestId('overview-scope-all')).toHaveAttribute('aria-checked', 'true')
  const all = await overviewNets(page)
  const peopleText = () => home.getByTestId('home-recent-people').innerText()
  const peopleBefore = await peopleText()
  expect(peopleBefore).toContain('Riya Sharma')
  expect(Object.keys(all).length).toBeGreaterThanOrEqual(3)
  // The chips are 44 px targets.
  for (const id of ['all', 'groups', 'direct']) expect((await home.getByTestId(`overview-scope-${id}`).boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await home.getByTestId('overview-scope-groups').click()
  await expect(page).toHaveURL(/\?overview=groups$/)
  await expect(home.getByTestId('overview-scope-groups')).toHaveAttribute('aria-checked', 'true')
  const groups = await overviewNets(page)
  await home.getByTestId('overview-scope-direct').click()
  await expect(page).toHaveURL(/\?overview=direct$/)
  await expect(home.getByTestId('overview-scope-direct')).toHaveAttribute('aria-checked', 'true')
  const direct = await overviewNets(page)

  // Both views have balances in two or more currencies, and they differ from All.
  expect(Object.keys(groups).length).toBeGreaterThanOrEqual(2)
  expect(Object.keys(direct).length).toBeGreaterThanOrEqual(2)
  expect(groups).not.toEqual(all)
  expect(direct).not.toEqual(all)
  // Per currency, never summed across currencies: all = groups + direct.
  for (const code of Object.keys(all)) expect(all[code]!, code).toBeCloseTo((groups[code] ?? 0) + (direct[code] ?? 0), 2)
  // The sections below are the same whatever the scope: the rows of Recently active people read the same text (their
  // balances included), not just the same count.
  expect(await peopleText()).toBe(peopleBefore)
  await home.getByTestId('overview-scope-groups').click()
  expect(await peopleText()).toBe(peopleBefore)
  await home.getByTestId('overview-scope-direct').click()

  // Analytics carries the scope: Everything, all groups, non-group only.
  await expect(home.getByTestId('overview-analytics')).toHaveAttribute('href', /scope=1(:|%3A)$/)
  await home.getByTestId('overview-analytics').click()
  await expect(page).toHaveURL(/\/analytics\?from=home&scope=1(:|%3A)$/)
  await expect(page.getByTestId('screen-analytics')).toBeVisible()

  // Remembered (a preference), so the bare address reads the same; All, from a saved Groups, is written out.
  await page.goto('/')
  await expect(page.getByTestId('screen-home').getByTestId('overview-scope-direct')).toHaveAttribute('aria-checked', 'true')
  expect(await overviewNets(page)).toEqual(direct)
  await page.goto('/?overview=groups')
  await expect(page.getByTestId('screen-home').getByTestId('overview-scope-groups')).toHaveAttribute('aria-checked', 'true')
  expect(await overviewNets(page)).toEqual(groups)
  await page.getByTestId('screen-home').getByTestId('overview-analytics').click()
  await expect(page).toHaveURL(/\/analytics\?from=home&scope=0(:|%3A)all$/)
  await page.goto('/')
  await page.getByTestId('screen-home').getByTestId('overview-scope-all').click()
  await expect(page).toHaveURL(/\?overview=all$/)
  expect(await overviewNets(page)).toEqual(all)
  // All carries an explicit Everything scope too, or Analytics would keep the scope it saved last.
  await expect(page.getByTestId('screen-home').getByTestId('overview-analytics')).toHaveAttribute('href', /scope=1(:|%3A)all$/)
})

test('a main screen opened from a link is a pushed page: Back to Home, no FAB; its own tab has the avatar (owner 179)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  const home = page.getByTestId('screen-home')
  await expect(home.getByTestId('header-avatar')).toBeVisible()
  await home.getByTestId('home-recent-groups-all').click()
  await expect(page).toHaveURL(/\/groups\?from=home$/)
  const groups = page.getByTestId('screen-groups').last()
  await expect(groups.getByTestId('header-back')).toBeVisible()
  await expect(groups.getByTestId('header-avatar')).toHaveCount(0)
  await expect(groups.getByTestId('fab-add')).toHaveCount(0)
  // Back returns to Home.
  await groups.getByTestId('header-back').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('screen-home').getByTestId('header-avatar')).toBeVisible()
  // The Groups tab itself is the plain tab screen: the avatar and the FAB.
  await page.getByTestId('tab-groups').click()
  await expect(page).toHaveURL(/\/groups$/)
  const tab = page.getByTestId('screen-groups').last()
  await expect(tab.getByTestId('header-avatar')).toBeVisible()
  await expect(tab.getByTestId('header-back')).toHaveCount(0)
  await expect(tab.getByTestId('fab-add')).toBeVisible()
  // The other links: Analytics from an Overview card, People from the recent people.
  await page.getByTestId('tab-home').click()
  await page.getByTestId('screen-home').getByTestId('overview-analytics').click()
  await expect(page.getByTestId('screen-analytics').last().getByTestId('header-back')).toBeVisible()
  await page.getByTestId('screen-analytics').last().getByTestId('header-back').click()
  await page.getByTestId('screen-home').getByTestId('home-recent-people-all').click()
  const people = page.getByTestId('screen-people').last()
  await expect(people.getByTestId('header-back')).toBeVisible()
  await expect(people.getByTestId('fab-add')).toHaveCount(0)
})

for (const [name, size, bar] of [['390', PHONE, 'tab-groups'], ['1440', DESKTOP, 'tab-groups']] as const) {
  test(`pressing a tab while on its own pushed copy gives the plain tab at ${name} (owner 179)`, async ({page}) => {
    await page.setViewportSize(size)
    await openDemo(page)
    await page.getByTestId('screen-home').getByTestId('home-recent-groups-all').click()
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
  await expect(warm.getByTestId('fab-add')).toHaveCount(0)
  await warm.getByTestId('header-back').click()
  await expect(page.getByTestId('screen-home').getByTestId('header-avatar')).toBeVisible()
  // Cold: the same address typed into the browser is the plain tab.
  await page.goto('/groups')
  const cold = page.getByTestId('screen-groups').last()
  await expect(cold.getByTestId('header-avatar')).toBeVisible()
  await expect(cold.getByTestId('header-back')).toHaveCount(0)
})

/* Owner 184 (F-263): every page has a fixed parent. Refreshed or pasted, Back goes to it, and a second Back keeps climbing. */
const TAB_SCREENS = ['screen-home', 'screen-people', 'screen-groups', 'screen-analytics', 'screen-activity']
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

test('refreshed or pasted, Back climbs to the fixed parent and on to Home (owner 184)', async ({page}) => {
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
  // Settings > Appearance: Settings, then Home.
  await page.goto('/settings/appearance')
  await expect(page.getByTestId('screen-settings-section')).toBeVisible()
  await backUp(page, 'screen-settings-section', ['screen-settings', 'screen-home'])
  // A friend: People, then Home.
  await page.goto(`/people/${ids.person}`)
  await expect(page.getByTestId('screen-person')).toBeVisible()
  await backUp(page, 'screen-person', ['screen-people', 'screen-home'])
  // A group: Groups, then Home.
  await page.goto(`/groups/${ids.group}`)
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await backUp(page, 'screen-group', ['screen-groups', 'screen-home'])
  // An expense in a group: that group, Groups, Home.
  await page.goto(`/expense/${ids.groupExpense}`)
  await expect(page.getByTestId('screen-expense')).toBeVisible()
  await expect(page.getByTestId('expense-detail-title')).toBeVisible()
  await backUp(page, 'screen-expense', ['screen-group', 'screen-groups', 'screen-home'])
  // An expense with one friend and no group: that friend, People, Home.
  await page.goto(`/expense/${ids.directExpense}`)
  await expect(page.getByTestId('expense-detail-title')).toBeVisible()
  await backUp(page, 'screen-expense', ['screen-person', 'screen-people', 'screen-home'])
  // Profile: Settings, Home. Friends and invites: People, Home.
  await page.goto('/profile')
  await backUp(page, 'screen-profile', ['screen-settings', 'screen-home'])
  await page.goto('/settings/friends')
  await backUp(page, 'screen-friends-invites', ['screen-people', 'screen-home'])
})

test('a pushed Activity copy keeps its Back after a refresh, and tapping the tab drops it (owner 179, 184)', async ({page}) => {
  for (const size of [PHONE, DESKTOP]) {
    await page.setViewportSize(size)
    await openDemo(page)
    await page.getByTestId('screen-home').getByTestId('home-recent-transactions-all').click()
    await expect(page).toHaveURL(/\/activity\?from=home&type=transactions$/)
    await expect(page.getByTestId('screen-activity').last().getByTestId('header-back')).toBeVisible()
    await page.reload()
    const copy = page.getByTestId('screen-activity').last()
    await expect(copy.getByTestId('header-back')).toBeVisible()
    await expect(copy.getByTestId('header-avatar')).toHaveCount(0)
    await backUp(page, 'screen-activity', ['screen-home'])
    // The tab itself is the plain tab, and its address has no from.
    await page.getByTestId('tab-activity').click()
    await expect(page).toHaveURL(/\/activity$/)
    await expect(page.getByTestId('screen-activity').last().getByTestId('header-avatar')).toBeVisible()
  }
})

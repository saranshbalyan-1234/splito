import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'
import {pinClock} from './pinClock'

/*
 * ARCHITECTURE 26.12, owners 113/114/120/198 (F-245, F-248, F-256, F-271): the Overview is the first section of
 * Analytics ("Balances right now"), above its filter row; nothing is cut off or crowded, the cards are separate equal
 * boxes in a balanced grid that re-lays out with the width. People reads requests, invites row, then the Friends list
 * (with its own search).
 */

const WIDTHS = [320, 390, 600, 800, 1440]

type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
}

async function openPage(page: Page, width: number, path = '/analytics') {
  await page.setViewportSize({width, height: 900})
  await openDemo(page, path)
  if (path === '/analytics') await expect(page.getByTestId('analytics-overview')).toBeVisible()
  else await expect(page.getByTestId('screen-people').getByTestId('person-Arjun Mehta')).toBeVisible()
}

/** Every Overview card on the screen: its box, plus whether any label or figure inside is clipped. */
async function cards(page: Page, screen = 'screen-analytics') {
  return page.getByTestId(screen).evaluate(root => {
    const out: {id: string; x: number; y: number; w: number; h: number; clipped: string[]}[] = []
    for (const link of root.querySelectorAll<HTMLElement>('[data-testid^="summary-"]')) {
      const id = link.dataset.testid!
      if (id.split('-').length !== 2 || id === 'summary-settled') continue
      const card = link.parentElement!
      const box = card.getBoundingClientRect()
      const clipped: string[] = []
      for (const el of link.querySelectorAll<HTMLElement>('*')) {
        // A text node's own box: it must not scroll past or be cut by its container.
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && el.childElementCount === 0)
          clipped.push(el.textContent ?? '')
        const style = getComputedStyle(el)
        if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth) clipped.push(el.textContent ?? '')
      }
      if (link.scrollWidth > link.clientWidth + 1) clipped.push('card')
      out.push({id, x: box.x, y: box.y, w: box.width, h: box.height, clipped})
    }
    return out
  })
}

function rowsOf<T extends {y: number}>(list: T[]) {
  const rows = new Map<number, T[]>()
  for (const c of list) rows.set(Math.round(c.y), [...(rows.get(Math.round(c.y)) ?? []), c])
  return [...rows.values()]
}

for (const width of WIDTHS) {
  test(`Analytics Overview at ${width}px: nothing cut off, cards equal, above the filter row`, async ({page}) => {
    await openPage(page, width)
    const all = await cards(page)
    expect(all.length).toBeGreaterThan(1)
    for (const c of all) expect(c.clipped, `${c.id} clipped`).toEqual([])
    // Equal width everywhere; equal height within a row; a short last row stays left-aligned.
    for (const c of all) expect(Math.abs(c.w - all[0]!.w)).toBeLessThan(1.5)
    const rows = rowsOf(all)
    for (const row of rows) for (const c of row) expect(Math.abs(c.h - row[0]!.h)).toBeLessThan(1.5)
    for (const row of rows) expect(Math.abs(row[0]!.x - rows[0]![0]!.x)).toBeLessThan(1.5)
    expect(Math.max(...rows.map(r => r.length))).toBeLessThanOrEqual(3)

    // The Overview is the first section: its title sits above the filter row it ignores (owner 198), and it says so.
    await expect(page.getByTestId('analytics-overview-title')).toHaveText('Balances right now')
    expect(await y(page, 'analytics-overview-title')).toBeLessThan(await y(page, 'analytics-currency'))
    expect(await y(page, 'analytics-overview-counts')).toBeLessThan(await y(page, 'analytics-currency'))
    // Home is gone: no Recent sections, no requests, no Friends list on Analytics.
    for (const id of ['home-recent-transactions-title', 'home-recent-people-title', 'home-recent-groups-title', 'people-requests-title', 'people-friends-title', 'overview-analytics'])
      await expect(page.getByTestId(id)).toHaveCount(0)
  })
}

test('People shows requests then Invites sent as rows, at most 5 in all, above the Friends list; the full list is on Friends and invites', async ({page}) => {
  await openPage(page, 390, '/people')
  const home = page.getByTestId('screen-people')
  await expect(home.getByTestId('people-invites-title')).toContainText('Invites sent')
  const rows = home
    .getByTestId('people-requests')
    .locator('[data-testid^="request-"], [data-testid^="invite-sent-"]')
  const named = await rows.evaluateAll(els =>
    els.map(e => e.getAttribute('data-testid')!).filter(id => !/accept|decline|resend|cancel|-sync|-actions|tooltip|title/.test(id)),
  )
  const unique = new Set(named)
  expect(unique.size).toBeGreaterThan(2)
  expect(unique.size, [...unique].join(', ')).toBeLessThanOrEqual(5)
  const kabir = home.getByTestId('invite-sent-Kabir')
  await expect(kabir).toContainText(/Invited, not on Splito yet|Waiting to accept/)
  // No row carries a coloured sync dot (owner 111).
  await expect(kabir.locator('[data-testid$="-sync"]')).toHaveCount(0)
  await expect(home.getByTestId('request-Ishaan Verma').locator('[data-testid$="-sync"]')).toHaveCount(0)
  // Resend and Cancel sit on the right in one horizontal line.
  const row = (await kabir.boundingBox())!
  const resend = (await kabir.getByTestId('invite-sent-resend').boundingBox())!
  const cancel = (await kabir.getByTestId('invite-sent-cancel').boundingBox())!
  expect(Math.abs(resend.y - cancel.y)).toBeLessThan(1)
  expect(cancel.x).toBeGreaterThan(resend.x + resend.width)
  expect(resend.x).toBeGreaterThan(row.x + row.width / 2)
  expect(row.height).toBeLessThan(72)
  // Requests, then the invites row, then the Friends list.
  const order = ['people-requests-title', 'people-invites-title', 'people-friends-title']
  const ys: number[] = []
  for (const id of order) ys.push(await y(page, id))
  expect([...ys].sort((p, q) => p - q)).toEqual(ys)
  // The full list is Activity's Friends and invites type (owner 195), where Resend and Cancel work in place.
  await page.goto('/activity/all?type=friends')
  await expect(page.getByTestId('activity-friendRequest.sent').filter({hasText: 'Kabir'})).toBeVisible()
})

const y = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!.y

test('with nothing waiting there is no invites row', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    await (window as unknown as {splito: Splito}).splito.createPerson('Kavya Rao')
  })
  await page.goto('/people')
  await expect(page.getByTestId('person-Kavya Rao')).toBeVisible()
  await expect(page.getByTestId('people-invites-title')).toHaveCount(0)
  await expect(page.getByTestId('people-requests-title')).toHaveCount(0)
})

test('a friend row is at most two lines at 390px, amounts vertically centred, chips do not wrap, the last row clears the FAB', async ({page}) => {
  await openPage(page, 390, '/people')
  const rows = page.getByTestId('screen-people').locator('[data-testid^="person-"]:not([data-testid*="-more"]):not([data-testid$="-chips"]):not([data-testid$="-deleted"]):not([data-testid="person-row-nets"])').filter({has: page.locator('[data-testid^="balance-"]')})
  const n = await rows.count()
  expect(n).toBeGreaterThan(3)
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i)
    const box = (await row.boundingBox())!
    // Name line + chip line + the row's padding: two lines, not three.
    expect(box.height, (await row.getAttribute('data-testid')) ?? '').toBeLessThanOrEqual(96)
    // The amounts column is vertically centred in the row, whether it holds one line or several (owner 130).
    const nets = (await row.getByTestId('person-row-nets').boundingBox())!
    const avatarBlock = (await row.locator('xpath=./*').first().boundingBox())!
    expect(Math.abs(nets.y + nets.height / 2 - (avatarBlock.y + avatarBlock.height / 2))).toBeLessThanOrEqual(2)
    const chips = row.locator('[data-testid$="-chips"]')
    if (await chips.count()) {
      const kids = chips.first().locator('> *')
      const tops = await kids.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)))
      expect(new Set(tops).size).toBeLessThanOrEqual(1)
      expect(await kids.count()).toBeLessThanOrEqual(3)
    }
  }
  // The last row, scrolled to the end, sits above the FAB.
  const last = page.getByTestId('screen-people').locator('[data-testid^="person-"]').last()
  await last.scrollIntoViewIfNeeded()
  await page.getByTestId('screen-people').getByTestId('fab-inset').scrollIntoViewIfNeeded()
  const fab = (await page.getByTestId('screen-people').getByTestId('fab-add').boundingBox())!
  const lastBox = (await last.boundingBox())!
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(fab.y + 1)
})

test('Friends search filters live by name and combines with Filters', async ({page}) => {
  await openPage(page, 1440, '/people')
  const people = page.getByTestId('screen-people')
  const all = await people.locator('[data-testid^="person-"][data-testid*=" "]').count()
  await people.getByTestId('list-search').click()
  await people.getByTestId('list-search-input').fill('riya')
  await expect(people.getByTestId('person-Riya Sharma')).toBeVisible()
  await expect(people.getByTestId('person-Arjun Mehta')).toHaveCount(0)
  await expect(people.getByTestId('list-search-count')).toContainText(/^\d+ of \d+$/)
  await people.getByTestId('list-search-input').fill('zzzz')
  await expect(people.getByTestId('people-search-empty')).toBeVisible()
  // Clearing folds it back and restores the list.
  await people.getByTestId('list-search-input').fill('')
  await expect(people.locator('[data-testid^="person-"][data-testid*=" "]')).toHaveCount(all)
})

/** Six currencies with one friend, so the Overview has 6 cards. */
async function seedCurrencies(page: Page, codes: string[]) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async codes => {
    const s = (window as unknown as {splito: Splito}).splito
    const friend = await s.createPerson('Kavya Rao')
    for (const currency of codes)
      await s.createExpense({
        currency,
        tz: 'Asia/Kolkata',
        category: 'food',
        notes: '',
        title: `Dinner ${currency}`,
        groupId: null,
        total: '123456789',
        payers: {[s.me]: '123456789'},
        split: {mode: 'equal', participants: [s.me, friend]},
        date: '2026-10-20',
      })
  }, codes)
  await page.goto('/analytics')
  await expect(page.getByTestId('summary-INR')).toBeVisible()
}

test('six currencies lay out 3 x 2, then 2 x 3 and 1 a row as the window narrows, live', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await seedCurrencies(page, ['INR', 'EUR', 'USD', 'GBP', 'JPY', 'AUD'])
  const perRow = async () => rowsOf(await cards(page)).map(r => r.length)
  expect(await perRow()).toEqual([3, 3])
  await page.setViewportSize({width: 600, height: 900})
  await expect.poll(perRow).toEqual([2, 2, 2])
  await page.setViewportSize({width: 390, height: 900})
  await expect.poll(perRow).toEqual([1, 1, 1, 1, 1, 1])
  for (const width of [320, 390, 600, 1440]) {
    await page.setViewportSize({width, height: 900})
    await expect.poll(async () => (await cards(page)).flatMap(c => c.clipped)).toEqual([])
  }
})


const PHONE = {width: 390, height: 844}

test('Overview cards at 390: compact, the net alone is coloured and on the right, the breakdown is plain text on the left', async ({page}) => {
  await page.setViewportSize(PHONE)
  await pinClock(page)
  await openDemo(page, '/analytics')
  await expect(page.getByTestId('analytics-overview')).toBeVisible()
  const cards = await page.getByTestId('analytics-overview').evaluate(root => {
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
        // The testID is on a wrapper; the figure's text (and its colour) is its child.
        netColour: getComputedStyle(net.firstElementChild ?? net).color,
        netSaturation: sat(getComputedStyle(net.firstElementChild ?? net).color),
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
  // Six currencies fit one phone screen with the header, the section title and the bottom bar (Analytics now starts with them, owner 198).
  const barTop = (await page.getByTestId('tab-people').boundingBox())!.y
  expect(cards[5]!.bottom).toBeLessThanOrEqual(barTop)
  expect(cards[5]!.bottom).toBeLessThanOrEqual(PHONE.height)
})


/** The signed net of each Overview card, by currency: "You owe" is negative. */
async function rawNets(page: Page) {
  const cards = page.getByTestId('analytics-overview').locator('[data-testid$="-card"]')
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

test('Overview scope: All, Groups and Direct change only the cards; it is in the address and remembered; a card narrows Analytics (owners 176, 198)', async ({page}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/analytics')
  const overview = page.getByTestId('screen-analytics').getByTestId('analytics-overview')
  await expect(overview.getByTestId('overview-scope-all')).toHaveAttribute('aria-checked', 'true')
  const all = await overviewNets(page)
  expect(Object.keys(all).length).toBeGreaterThanOrEqual(3)
  // The chips are 44 px targets.
  for (const id of ['all', 'groups', 'direct']) expect((await overview.getByTestId(`overview-scope-${id}`).boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await overview.getByTestId('overview-scope-groups').click()
  await expect(page).toHaveURL(/\/analytics\?overview=groups$/)
  await expect(overview.getByTestId('overview-scope-groups')).toHaveAttribute('aria-checked', 'true')
  const groups = await overviewNets(page)
  await overview.getByTestId('overview-scope-direct').click()
  await expect(page).toHaveURL(/\/analytics\?overview=direct$/)
  await expect(overview.getByTestId('overview-scope-direct')).toHaveAttribute('aria-checked', 'true')
  const direct = await overviewNets(page)

  // Both views have balances in two or more currencies, and they differ from All.
  expect(Object.keys(groups).length).toBeGreaterThanOrEqual(2)
  expect(Object.keys(direct).length).toBeGreaterThanOrEqual(2)
  expect(groups).not.toEqual(all)
  expect(direct).not.toEqual(all)
  // Per currency, never summed across currencies: all = groups + direct.
  for (const code of Object.keys(all)) expect(all[code]!, code).toBeCloseTo((groups[code] ?? 0) + (direct[code] ?? 0), 2)

  // Remembered (a preference), so the bare address reads the same; the old Home address redirects here.
  await page.goto('/analytics')
  await expect(page.getByTestId('screen-analytics').getByTestId('overview-scope-direct')).toHaveAttribute('aria-checked', 'true')
  expect(await overviewNets(page)).toEqual(direct)
  await page.goto('/?overview=groups')
  await expect(page).toHaveURL(/\/analytics\?overview=groups$/)
  await expect(page.getByTestId('screen-analytics').getByTestId('overview-scope-groups')).toHaveAttribute('aria-checked', 'true')
  expect(await overviewNets(page)).toEqual(groups)
  // All, from a saved Groups, is written out or the address would fall back to Groups.
  await page.getByTestId('screen-analytics').getByTestId('overview-scope-all').click()
  await expect(page).toHaveURL(/\/analytics\?overview=all$/)
  expect(await overviewNets(page)).toEqual(all)

  // A card opens the rest of Analytics in its currency and carries the scope (owner 176); the cards ignore currency.
  await page.getByTestId('screen-analytics').getByTestId('overview-scope-groups').click()
  const code = Object.keys(groups)[0]!
  await page.getByTestId('screen-analytics').getByTestId(`summary-${code}`).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('currency')).toBe(code)
  const q = new URL(page.url()).searchParams
  expect(q.get('scope')).toBe('0:all')
  expect(q.get('overview')).toBe('groups')
  await expect(page.getByTestId('screen-analytics').getByTestId('analytics-currency')).toHaveText(code)
  expect(await overviewNets(page)).toEqual(groups)
})

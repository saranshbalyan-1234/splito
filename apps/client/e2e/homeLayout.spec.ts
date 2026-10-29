import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * ARCHITECTURE 26.12, owners 113/114/120 (F-245, F-248, F-256): Home reads top-down
 * (Overview, requests, invites row, then the recent lists), nothing is cut off or
 * crowded, the Overview cards are separate equal boxes in a balanced grid that
 * re-lays out with the width, and the Friends list (now on People) has its own search.
 */

const WIDTHS = [320, 390, 600, 800, 1440]

type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
}

async function openHome(page: Page, width: number, path = '/') {
  await page.setViewportSize({width, height: 900})
  await openDemo(page, path)
  if (path === '/') await expect(page.getByTestId('home-overview')).toBeVisible()
  else await expect(page.getByTestId('screen-people').getByTestId('person-Arjun Mehta')).toBeVisible()
}

/** Every Overview card on the screen: its box, plus whether any label or figure inside is clipped. */
async function cards(page: Page, screen = 'screen-home') {
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
  test(`Home at ${width}px: nothing cut off, cards equal, sections in order`, async ({page}) => {
    await openHome(page, width)
    const all = await cards(page)
    expect(all.length).toBeGreaterThan(1)
    for (const c of all) expect(c.clipped, `${c.id} clipped`).toEqual([])
    // Equal width everywhere; equal height within a row; a short last row stays left-aligned.
    for (const c of all) expect(Math.abs(c.w - all[0]!.w)).toBeLessThan(1.5)
    const rows = rowsOf(all)
    for (const row of rows) for (const c of row) expect(Math.abs(c.h - row[0]!.h)).toBeLessThan(1.5)
    for (const row of rows) expect(Math.abs(row[0]!.x - rows[0]![0]!.x)).toBeLessThan(1.5)
    expect(Math.max(...rows.map(r => r.length))).toBeLessThanOrEqual(3)

    // Overview, then requests, then the invites row, then the recent lists; no Friends list on Home.
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    const order = ['home-overview-title', 'people-requests-title', 'people-invites-waiting', 'home-recent-transactions-title', 'home-recent-people-title', 'home-recent-groups-title']
    const ys: number[] = []
    for (const id of order) ys.push(await y(id))
    expect([...ys].sort((p, q) => p - q)).toEqual(ys)
    await expect(page.getByTestId('people-friends-title')).toHaveCount(0)
    // Sent invites are not on Home, and no row carries a coloured sync dot.
    await expect(page.getByTestId('invite-sent-Kabir')).toHaveCount(0)
    await expect(page.getByTestId('people-invites-title')).toHaveCount(0)
    await expect(page.getByTestId('request-Ishaan Verma').locator('[data-testid$="-sync"]')).toHaveCount(0)
  })
}

test('the invites row opens Friends and invites, where Invites sent live', async ({page}) => {
  await openHome(page, 390)
  await expect(page.getByTestId('people-invites-waiting')).toContainText(/\d+ invites? waiting/)
  await page.getByTestId('people-invites-waiting').click()
  await expect(page.getByTestId('screen-friends-invites')).toBeVisible()
  await expect(page.getByTestId('invite-sent-Kabir')).toBeVisible()
  await expect(page.getByTestId('invite-sent-Kabir').locator('[data-testid$="-sync"]')).toHaveCount(0)
})

test('with nothing waiting there is no invites row', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    await (window as unknown as {splito: Splito}).splito.createPerson('Kavya Rao')
  })
  await page.goto('/people')
  await expect(page.getByTestId('person-Kavya Rao')).toBeVisible()
  await expect(page.getByTestId('people-invites-waiting')).toHaveCount(0)
})

test('a friend row is at most two lines at 390px, amounts vertically centred, chips do not wrap, the last row clears the FAB', async ({page}) => {
  await openHome(page, 390, '/people')
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
  await openHome(page, 1440, '/people')
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
  await page.goto('/')
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


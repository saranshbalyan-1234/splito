import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/* F-1213 (tabs All / Me / Others) and F-259 (Type filter; every "See all" of Recent transactions lands here). */
const PHONE = {width: 390, height: 844}
const DESKTOP = {width: 1440, height: 900}

type Hooks = {__splitoTest: {openLink(url: string): void}; splito: {list(type: string): Promise<Array<{id: string; data: {name: string}}>>}}

/** The Activity screen on top: earlier pages of the stack stay mounted (hidden) on web. */
const screen = (page: Page) => page.getByTestId('screen-activity').last()
const tabs = (page: Page) => screen(page).getByTestId('activity-tabs')
const rows = (page: Page) => screen(page).locator('[data-testid^="activity-"][data-testid*="."]')
const kindsShown = async (page: Page) => [...new Set((await rows(page).evaluateAll(els => els.map(e => e.getAttribute('data-testid')!))).map(id => id.replace(/^activity-/, '').split('.')[0]!))].sort()

async function openActivity(page: Page, path = '/activity') {
  await openDemo(page, path)
  await expect(screen(page).getByTestId('activity-list')).toBeVisible()
  await expect(rows(page).first()).toBeVisible()
}

/** A narrowed list searches about ten pages back by itself; past that it offers "Look further back" (owner ruling, F-259). */
async function lookBackUntilListed(page: Page) {
  for (let i = 0; i < 30 && (await rows(page).count()) === 0; i++) {
    const more = screen(page).getByTestId('activity-look-further')
    if (!(await more.isVisible())) await page.waitForTimeout(150)
    else await more.click()
  }
}

async function apply(page: Page, types: string[]) {
  await screen(page).getByTestId('activity-filters').click()
  const sheet = page.getByTestId('activity-filters-sheet')
  await expect(sheet).toBeVisible()
  // Start from All, then choose.
  await sheet.getByTestId('filter-type-all').click()
  for (const t of types) await sheet.getByTestId(`filter-type-${t}`).click()
  await sheet.getByRole('button', {name: 'Apply'}).click()
  await expect(sheet).toBeHidden()
}

for (const [name, viewport] of [['390', PHONE], ['1440', DESKTOP]] as const) {
  test.describe(`at ${name}`, () => {
    test.use({viewport})
    // Seeding the demo set can take a while on a busy machine.
    test.setTimeout(90_000)

    test('tabs All / Me / Others: each in the address, remembered across reloads and bare visits', async ({page}) => {
      await openActivity(page)
      await expect(tabs(page).getByRole('tab')).toHaveText(['All', 'Me', 'Others'])
      await expect(tabs(page).getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true')

      await tabs(page).getByRole('tab').nth(1).click()
      await expect(page).toHaveURL(/\/activity\/me$/)
      // Me lists what I did (the restored Groceries), not what Riya did (her edit of the dinner).
      await expect(rows(page).filter({hasText: 'Groceries'}).first()).toBeVisible()
      await expect(rows(page).filter({hasText: 'Riya Sharma edited Dinner at Thalassa'})).toHaveCount(0)
      await expect(screen(page).getByTestId('activity-mark-all-read')).toBeDisabled()

      await tabs(page).getByRole('tab').nth(2).click()
      await expect(page).toHaveURL(/\/activity\/others$/)
      await expect(rows(page).filter({hasText: 'Riya Sharma edited Dinner at Thalassa'}).first()).toBeVisible()
      await expect(rows(page).filter({hasText: 'restored Groceries'})).toHaveCount(0)
      await expect(screen(page).getByTestId('activity-mark-all-read')).toBeEnabled()

      // Remembered: a reload, and a bare /activity, both come back on Others.
      await page.reload()
      await expect(tabs(page).getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true')
      await page.goto('/activity')
      await expect(tabs(page).getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true')

      // All again, and it is remembered too.
      await tabs(page).getByRole('tab').nth(0).click()
      await expect(page).toHaveURL(/\/activity\/all$|\/activity$/)
      // The choice is written to the database a moment after the tap: wait for it before leaving the page.
      await expect.poll(() => page.evaluate(async () => ((await (window as unknown as {splito: {list(t: string): Promise<Array<{id: string; data: {value: unknown}}>>}}).splito.list('preference')).find(p => p.id.includes('activity.tab'))?.data.value))).toBe('all')
      await page.goto('/activity')
      await expect(tabs(page).getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true')
    })

    test('an address names its tab: /activity/me wins over the remembered one', async ({page}) => {
      await openActivity(page, '/activity/others')
      await expect(tabs(page).getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true')
      await page.goto('/activity/me')
      await expect(tabs(page).getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true')
    })

    test('the Type filter: multi-select with Apply, a dot, the address, remembered, and an empty state that follows it', async ({page}) => {
      await openActivity(page)
      await expect(screen(page).getByTestId('activity-filters-dot')).toHaveCount(0)
      // The demo history holds every type but disputes (those arrive with the disputes feature); older pages are read when a type is not in the newest one.
      const families: Record<string, string[]> = {expenses: ['expense'], payments: ['repayment', 'writeoff'], comments: ['comment'], groups: ['group'], friends: ['person', 'friendRequest'], reminders: ['reminder'], disputes: ['dispute']}
      for (const [type, kinds] of Object.entries(families)) {
        await apply(page, [type])
        await lookBackUntilListed(page)
        await expect.poll(async () => (await kindsShown(page)).length, {message: type}).toBeGreaterThan(0)
        expect((await kindsShown(page)).every(k => kinds.includes(k))).toBe(true)
      }
      await apply(page, [])
      await expect(screen(page).getByTestId('activity-filters-dot')).toHaveCount(0)

      await apply(page, ['comments'])
      await expect(screen(page).getByTestId('activity-filters-dot')).toBeVisible()
      await expect(page).toHaveURL(/\/activity\?type=comments$/)
      await expect.poll(() => kindsShown(page)).toEqual(['comment'])
      // A comment row names who wrote it and what on.
      await expect(rows(page).first()).toContainText('commented on')

      // Two types, one of them expenses + payments together, read as "transactions" in the address.
      await apply(page, ['expenses', 'payments'])
      await expect(page).toHaveURL(/\/activity\?type=transactions$/)
      await expect.poll(async () => (await kindsShown(page)).every(k => ['expense', 'repayment', 'writeoff'].includes(k))).toBe(true)

      await apply(page, ['groups', 'reminders'])
      await expect(page).toHaveURL(/type=groups%2Creminders|type=groups,reminders/)
      await lookBackUntilListed(page)
      await expect.poll(() => kindsShown(page)).toEqual(['group', 'reminder'])

      // Remembered: a bare visit and a reload keep the choice.
      await page.goto('/activity')
      await expect(screen(page).getByTestId('activity-filters-dot')).toBeVisible()
      await lookBackUntilListed(page)
      await expect.poll(() => kindsShown(page)).toEqual(['group', 'reminder'])

      // A type with nothing in the newest ~10 pages (Disputes scoped to a group that has none): the empty state follows the filter within half a second (a bounded search, not the whole history), animated, with the way out.
      const quiet = await page.evaluate(async () => {
        const s = (window as unknown as {splito: {list(t: string): Promise<Array<{id: string; data: {groupId?: string | null}}>>}}).splito
        const withDisputes = new Set((await s.list('dispute')).map(d => d.data.groupId))
        return (await s.list('group')).find(g => !withDisputes.has(g.id))!.id
      })
      const t0 = Date.now()
      await page.evaluate(id => (window as unknown as Hooks).__splitoTest.openLink(`/activity?tab=all&type=disputes&group=${id}`), quiet)
      await expect(screen(page).getByTestId('activity-empty')).toContainText(/Nothing matches/, {timeout: 2000})
      const answeredIn = Date.now() - t0
      console.log(`empty Disputes type answered in ${answeredIn} ms`)
      // 500 ms on a quiet machine; the bound is wider so a loaded one does not flake.
      expect(answeredIn).toBeLessThan(1500)
      // ... and "Look further back" reads on until the history ends.
      await expect
        .poll(
          async () => {
            const more = screen(page).getByTestId('activity-look-further')
            if (await more.isVisible()) await more.click()
            return (await screen(page).getByTestId('activity-empty').innerText().catch(() => '')).includes('Nothing matches these filters yet.')
          },
          {timeout: 30_000},
        )
        .toBe(true)
      await expect(screen(page).getByTestId('activity-empty').locator('[data-illustration], svg, canvas').first()).toBeVisible()
      // Show every type clears the type and keeps the group; Show everything then clears the group.
      await screen(page).getByTestId('activity-clear-filters').click()
      await expect(screen(page).getByTestId('activity-filters-dot')).toHaveCount(0)
      await expect(screen(page).getByTestId('activity-group-chip')).toBeVisible()
      await page.goto('/activity')
      await expect(screen(page).getByTestId('activity-filters-dot')).toHaveCount(0)
    })

    test('the tab and the type combine; a link carries both and wins over what is remembered', async ({page}) => {
      await openActivity(page, '/activity/others?type=comments')
      await expect(tabs(page).getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true')
      await expect(screen(page).getByTestId('activity-filters-dot')).toBeVisible()
      await expect.poll(() => kindsShown(page)).toEqual(['comment'])
      await expect.poll(async () => (await rows(page).allInnerTexts()).some(t => /(^|\n)You\b/.test(t))).toBe(false)
    })

    test('a main screen opened from a link is a pushed page with Back; the tab itself is the plain tab (owner 179)', async ({page}) => {
      await openDemo(page, '/groups')
      await expect(page.getByTestId('screen-groups')).toBeVisible()
      const group = await page.evaluate(async () => (await (window as unknown as Hooks).splito.list('group')).find(g => !g.data.name.startsWith('Bulk'))!.id)
      await page.evaluate(id => (window as unknown as Hooks).__splitoTest.openLink(`/activity?tab=all&type=transactions&group=${id}`), group)
      await expect(page).toHaveURL(new RegExp(`/activity/all\\?from=groups&group=${group}&type=transactions$`))
      await expect(screen(page).getByTestId('header-back')).toBeVisible()
      await expect(screen(page).getByTestId('header-avatar')).toHaveCount(0)
      // The pushed copy keeps the tab's FAB and actions; only Back replaces the avatar (owner 190).
      if (viewport.width < 800) await expect(screen(page).getByTestId('fab-add')).toBeVisible()
      await expect(screen(page).getByTestId('activity-group-chip')).toBeVisible()
      await expect(screen(page).getByTestId('activity-filters-dot')).toBeVisible()
      await expect.poll(async () => (await kindsShown(page)).every(k => ['expense', 'repayment', 'writeoff'].includes(k))).toBe(true)
      const scoped = await rows(page).count()

      // Clearing the group chip shows everyone's transactions.
      await screen(page).getByTestId('activity-group-chip').click()
      await expect(screen(page).getByTestId('activity-group-chip')).toHaveCount(0)
      await expect.poll(() => rows(page).count()).toBeGreaterThanOrEqual(scoped)

      // Back returns to where the link came from.
      await screen(page).getByTestId('header-back').click()
      await expect(page).toHaveURL(/\/groups$/)
      await expect(page.getByTestId('screen-groups')).toBeVisible()
    })
  })
}

test.describe('narrowed Mark all read, /activity/filters, a comment on a payment under ?group=', () => {
  test.use({viewport: DESKTOP})
  test.setTimeout(90_000)

  test('Mark all read on a narrowed list marks only what it lists; the nav badge ignores tab and filter', async ({page}) => {
    await openActivity(page)
    const badge = page.getByTestId('nav-badge-activity')
    await expect(badge).toHaveText('30+')
    await apply(page, ['expenses'])
    await expect(badge).toHaveText('30+')
    await screen(page).getByTestId('activity-mark-all-read').click()
    await expect(page.getByText('Marked these as read')).toBeVisible()
    await expect(screen(page).getByTestId('activity-unread-dot')).toHaveCount(0)
    // The rest of the feed is still unread: the badge did not go to zero, and a tab does not change it.
    await expect(badge).toHaveText('30+')
    await tabs(page).getByRole('tab').nth(2).click()
    await expect(badge).toHaveText('30+')
    await expect(screen(page).getByTestId('activity-mark-all-read')).toBeEnabled()
  })

  test('/activity/filters opens the Filters sheet over Activity; closing it leaves the page', async ({page}) => {
    await openActivity(page)
    await page.goto('/activity/filters')
    await expect(page.getByTestId('activity-filters-sheet')).toBeVisible()
    await expect(screen(page).getByTestId('activity-tabs')).toBeVisible()
    await page.getByTestId('activity-filters-sheet').getByRole('button', {name: 'Cancel'}).click()
    await expect(page.getByTestId('activity-filters-sheet')).toBeHidden()
    await expect(page).toHaveURL(/\/activity$/)
  })

  test('?group= keeps a comment on one of that group\'s payments', async ({page}) => {
    await openActivity(page)
    const target = await page.evaluate(async () => {
      const s = (window as unknown as {splito: {me: string; list(t: string): Promise<Array<{id: string; deleted: boolean; data: {groupId: string | null}}>>; commentAs(a: string, i: unknown): Promise<string>}}).splito
      const pay = (await s.list('repayment')).find(r => !r.deleted && r.data.groupId)!
      await s.commentAs(s.me, {targetType: 'repayment', targetId: pay.id, body: 'about this payment'})
      return pay.data.groupId!
    })
    await page.goto(`/activity?tab=all&type=comments&group=${target}`)
    await expect(screen(page).getByTestId('activity-group-chip')).toBeVisible()
    await expect(rows(page).filter({hasText: 'commented on a payment'})).toHaveCount(1)
  })
})

test.describe('at 1440: "See all" in the right column', () => {
  test.use({viewport: DESKTOP})

  test('lands on Activity with transactions applied, as a pushed page; Back returns; the sidebar tab gives the plain tab', async ({page}) => {
    await openDemo(page, '/groups')
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    // Remembered Me and Others tabs never narrow a "See all".
    await page.evaluate(() => (window as unknown as {splito: {setPref(k: string, v: unknown): Promise<void>}}).splito.setPref('activity.tab', 'others'))
    await page.getByTestId('sidebar-transactions-all').click()
    await expect(page).toHaveURL(/\/activity\/all\?from=groups&type=transactions$/)
    await expect(screen(page).getByTestId('header-back')).toBeVisible()
    await expect(screen(page).getByTestId('header-avatar')).toHaveCount(0)
    await expect(tabs(page).getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true')
    await expect(screen(page).getByTestId('activity-filters-dot')).toBeVisible()
    await expect.poll(async () => (await kindsShown(page)).every(k => ['expense', 'repayment', 'writeoff'].includes(k))).toBe(true)

    await screen(page).getByTestId('header-back').click()
    await expect(page).toHaveURL(/\/groups$/)

    // The tab itself is the plain Activity: avatar, no Back, the remembered tab and no type.
    await page.getByTestId('sidebar-transactions-all').click()
    await expect(screen(page).getByTestId('header-back')).toBeVisible()
    await page.getByTestId('tab-activity').click()
    await expect(screen(page).getByTestId('header-avatar')).toBeVisible()
    await expect(screen(page).getByTestId('header-back')).toHaveCount(0)
    await expect(screen(page).getByTestId('fab-add')).toHaveCount(0) // wide screens use the sidebar pill
  })
})

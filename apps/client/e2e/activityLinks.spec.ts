import {expect, type Page, test} from '@playwright/test'

import {activityKinds, activityRows, activityScreen} from './activity'
import {openDemo, setPref} from './openDemo'
import {SIZES} from './viewports'

/*
 * F-268 (owners 192-195): every disputed amount, transactions heading or count, and request or invite link opens Activity
 * as a pushed copy (Back) on All with the matching Type filter, scoped to the group or friend it sits in. Demo data.
 */
type Hooks = {splito: {me: string; list(type: string): Promise<Array<{id: string; deleted: boolean; data: Record<string, any>}>>}}

const decoded = (page: Page) => decodeURIComponent(page.url())

/** Open disputes and holds in the demo set, with the record each is about: which groups and friends carry a disputed amount. */
async function disputedScopes(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as Hooks).splito
    const [disputes, expenses, repayments] = await Promise.all([s.list('dispute'), s.list('expense'), s.list('repayment')])
    const groups = new Set<string>()
    const people = new Set<string>()
    for (const d of disputes.filter(x => !x.deleted && x.data.status === 'open')) {
      const target = [...expenses, ...repayments].find(r => r.id === d.data.targetId)
      if (!target || target.deleted) continue
      if (target.data.groupId) groups.add(target.data.groupId)
      const parties = [...Object.keys(target.data.payers ?? {}), ...Object.keys(target.data.shares ?? {}), target.data.from, target.data.to].filter(Boolean)
      for (const p of parties) if (p !== s.me) people.add(p)
    }
    return {groups: [...groups], people: [...people]}
  })
}

/** Opens the first of `paths` where `selector` shows (a demo friend or group that carries a disputed amount). */
async function firstWith(page: Page, paths: string[], selector: string) {
  for (const path of paths) {
    await page.goto(path)
    if (await page.locator(selector).first().waitFor({state: 'visible', timeout: 8000}).then(() => true, () => false)) return path
  }
  throw new Error(`none of ${paths.length} pages shows ${selector}`)
}

/** The pushed copy: URL, Back, the Filters sheet with exactly `types` chosen, and only `families` of rows. */
async function expectActivityCopy(page: Page, opts: {url: RegExp; types: string[]; families: string[]; chip?: 'activity-group-chip' | 'activity-person-chip'}) {
  await expect(page).toHaveURL(/\/activity\/all/)
  expect(decoded(page)).toMatch(opts.url)
  await expect(activityScreen(page).getByTestId('header-back')).toBeVisible()
  if (opts.chip) await expect(activityScreen(page).getByTestId(opts.chip)).toBeVisible()
  await expect(activityRows(page).first()).toBeVisible({timeout: 30_000})
  for (const k of await activityKinds(page)) expect(opts.families, `a ${k} row`).toContain(k)
  await activityScreen(page).getByTestId('activity-filters').click()
  const sheet = page.getByTestId('activity-filters-sheet')
  await expect(sheet).toBeVisible()
  const all = ['expenses', 'payments', 'comments', 'groups', 'friends', 'reminders', 'disputes']
  for (const id of all) await expect(sheet.getByTestId(`filter-type-${id}`)).toHaveAttribute('aria-checked', String(opts.types.includes(id)))
  await expect(sheet.getByTestId('filter-type-all')).toHaveAttribute('aria-checked', 'false')
  await sheet.getByRole('button', {name: 'Cancel'}).click()
  await expect(sheet).toBeHidden()
}

const TRANSACTIONS = ['expense', 'repayment', 'writeoff']
const DISPUTED = [...TRANSACTIONS, 'dispute']

for (const [name, viewport] of SIZES) {
  test.describe(`activity links at ${name}`, () => {
    test.use({viewport})
    test.setTimeout(120_000)

    test('disputed: a Person page, a Group page and Settle open Activity on All with Expenses, Payments and Disputes; Back returns', async ({page}) => {
      // A saved Others tab must not narrow the pushed copy.
      await openDemo(page, '/')
      await setPref(page, 'activity.tab', 'others')
      const {groups, people} = await disputedScopes(page)
      expect(groups.length + people.length).toBeGreaterThan(0)

      // Person page: "of which ₹X disputed" is a link, scoped to the friend.
      const personPath = await firstWith(page, people.map(id => `/people/${id}`), '[data-testid^="person-disputed-link-"]')
      const personId = personPath.split('/').pop()!
      const link = page.getByTestId('screen-person').last().locator('[data-testid^="person-disputed-link-"]').first()
      await expect(link).toBeVisible()
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await link.click()
      await expectActivityCopy(page, {url: new RegExp(`type=expenses,payments,disputes.*person=${personId}|person=${personId}.*type=expenses,payments,disputes`), types: ['expenses', 'payments', 'disputes'], families: DISPUTED, chip: 'activity-person-chip'})
      await expect(activityScreen(page).getByTestId('activity-tabs').getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true')
      await activityScreen(page).getByTestId('header-back').click()
      await expect(page).toHaveURL(new RegExp(`/people/${personId}`))

      // Person's friend Settle up / Call it even notice.
      const notice = page.getByTestId('person-disputed-link')
      if (await notice.isVisible().catch(() => false)) {
        await notice.click()
        await expectActivityCopy(page, {url: /type=expenses,payments,disputes/, types: ['expenses', 'payments', 'disputes'], families: DISPUTED, chip: 'activity-person-chip'})
        await activityScreen(page).getByTestId('header-back').click()
      }

      // Group page: group balances "of which disputed", scoped to the group.
      const groupPath = await firstWith(page, groups.flatMap(id => [`/groups/${id}`, `/groups/${id}/balances`]), '[data-testid^="group-disputed-link-"], [data-testid^="group-balances-disputed-link-"]')
      const groupId = groupPath.split('/')[2]!
      const groupLink = page.getByTestId('screen-group').last().locator('[data-testid^="group-disputed-link-"], [data-testid^="group-balances-disputed-link-"]').first()
      await groupLink.click()
      await expectActivityCopy(page, {url: new RegExp(`type=expenses,payments,disputes.*group=${groupId}|group=${groupId}.*type=expenses,payments,disputes`), types: ['expenses', 'payments', 'disputes'], families: DISPUTED, chip: 'activity-group-chip'})
      await activityScreen(page).getByTestId('header-back').click()
      await expect(page).toHaveURL(new RegExp(`/groups/${groupId}`))

      // Settle: "₹X disputed, not in this plan".
      const settlePath = await firstWith(page, groups.map(id => `/groups/${id}/settle`), '[data-testid="settle-disputed-link"]')
      await page.getByTestId('settle-disputed-link').click()
      await expectActivityCopy(page, {url: new RegExp(`type=expenses,payments,disputes.*group=${settlePath.split('/')[2]}|group=${settlePath.split('/')[2]}.*type=expenses,payments,disputes`), types: ['expenses', 'payments', 'disputes'], families: DISPUTED, chip: 'activity-group-chip'})
      await activityScreen(page).getByTestId('header-back').click()
      await expect(page).toHaveURL(new RegExp(settlePath))
    })

    test('transactions: the right column, a Group heading and a Person heading open Activity on Expenses and Payments, scoped', async ({page}) => {
      await openDemo(page, '/')
      await setPref(page, 'activity.tab', 'me')
      /* The right column's heading and See all (>= 1300 px only; Home's own go with the Home tab, F-271). */
      if (viewport.width >= 1300) {
        for (const id of ['sidebar-transactions-title', 'sidebar-transactions-all']) {
          await page.goto('/people')
          await page.getByTestId(id).click()
          await expectActivityCopy(page, {url: /type=transactions/, types: ['expenses', 'payments'], families: TRANSACTIONS})
          await activityScreen(page).getByTestId('header-back').click()
        }
      }

      const {groups, people} = await disputedScopes(page)
      await page.goto(`/groups/${groups[0]}`)
      await page.getByTestId('group-expenses-title-link').click()
      await expectActivityCopy(page, {url: new RegExp(`type=transactions.*group=${groups[0]}|group=${groups[0]}.*type=transactions`), types: ['expenses', 'payments'], families: TRANSACTIONS, chip: 'activity-group-chip'})
      await activityScreen(page).getByTestId('header-back').click()

      await page.goto(`/people/${people[0]}`)
      await page.getByTestId('person-history-title-link').click()
      await expectActivityCopy(page, {url: new RegExp(`type=transactions.*person=${people[0]}|person=${people[0]}.*type=transactions`), types: ['expenses', 'payments'], families: TRANSACTIONS, chip: 'activity-person-chip'})
      // Only their events: clearing the chip lists more.
      const before = await activityRows(page).count()
      await activityScreen(page).getByTestId('activity-person-chip').click()
      await expect.poll(() => activityRows(page).count()).toBeGreaterThan(before)
      expect(decoded(page)).not.toContain('person=')
    })

    test('requests and invites: People links to Activity on Friends and invites; Accept and Cancel work in place', async ({page}) => {
      await openDemo(page, '/people')
      await page.getByTestId('screen-people').getByTestId('people-requests-title-link').click()
      await expectActivityCopy(page, {url: /type=friends/, types: ['friends'], families: ['friendRequest', 'groupRequest', 'person']})
      const kabir = () => activityScreen(page).getByTestId('activity-friendRequest.sent').filter({hasText: 'Kabir'})
      await expect(kabir().getByTestId('invite-sent-resend')).toBeVisible()
      await kabir().getByTestId('invite-sent-cancel').click()
      await expect(kabir().getByTestId('invite-sent-cancel')).toHaveCount(0)

      const ishaan = () => activityScreen(page).getByTestId('activity-friendRequest.received').filter({hasText: 'Ishaan Verma'})
      await ishaan().getByTestId('activity-request-accept').click()
      await expect(ishaan().getByTestId('activity-request-accept')).toHaveCount(0)
      await page.goto('/people')
      await expect(page.getByTestId('person-Ishaan Verma')).toBeVisible()
    })
  })
}

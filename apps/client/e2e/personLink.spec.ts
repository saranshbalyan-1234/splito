import {expect, type Locator, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-261 (owner 178, restated 2026-10-31): a person's avatar or name opens their page everywhere; my own opens Profile;
 * an unknown id opens "Not on this device yet". One PersonLink does it, so each surface is sampled at 390 and 1440.
 * Demo data.
 */
const SIZES = [
  ['390', {width: 390, height: 844}],
  ['1440', {width: 1440, height: 900}],
] as const

type Row = {id: string; deleted: boolean; data: Record<string, any>}
type Hooks = {splito: {me: string; list(type: string): Promise<Row[]>}}

/** A live group expense paid by someone other than me, with the people on it (ids and names). */
async function sample(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as Hooks).splito
    const [expenses, people] = await Promise.all([s.list('expense'), s.list('person')])
    const name = (id: string) => people.find(p => p.id === id)?.data.name as string
    const e = expenses.find(x => !x.deleted && x.data.groupId && Object.keys(x.data.payers).some(p => p !== s.me) && s.me in x.data.shares)!
    const payer = Object.keys(e.data.payers).find(p => p !== s.me)!
    return {me: s.me, expenseId: e.id, groupId: e.data.groupId as string, payer, payerName: name(payer)}
  })
}

/** The anchors a PersonLink renders inside `scope`, avatar-only and name-only alike. */
const anchors = (scope: Locator) => scope.locator('a[href^="/people/"], a[href="/profile"]')

async function expectTarget(link: Locator) {
  const box = (await link.boundingBox())!
  expect(box.height, 'a 44 px target').toBeGreaterThanOrEqual(43.5)
}

for (const [label, size] of SIZES) {
  test.describe(label, () => {
    test.use({viewport: size})

    test('expense detail: paid by, split rows and items open the person; me opens Profile', async ({page}) => {
      await openDemo(page)
      const s = await sample(page)
      await page.goto(`/expense/${s.expenseId}`)
      const paid = page.getByTestId(`paid-row-${s.payerName}`)
      await expect(paid).toBeVisible()
      const avatar = anchors(paid).first()
      await expectTarget(avatar)
      await avatar.click()
      await expect(page).toHaveURL(new RegExp(`/people/${s.payer}`))

      // The name is its own target too.
      await page.goBack()
      await anchors(page.getByTestId(`share-row-${s.payerName}`)).last().click()
      await expect(page).toHaveURL(new RegExp(`/people/${s.payer}`))

      // My own row opens Profile, not a friend page.
      await page.goBack()
      await anchors(page.getByTestId('share-row-You')).first().click()
      await expect(page).toHaveURL(/\/profile$/)
    })

    test('group Members and Balances: the row opens the person, Me opens Profile', async ({page}) => {
      await openDemo(page)
      const s = await sample(page)
      await page.goto(`/groups/${s.groupId}?tab=members`)
      const member = page.getByTestId(`member-${s.payerName}`)
      await expect(member).toBeVisible()
      await expectTarget(member)
      await member.click()
      await expect(page).toHaveURL(new RegExp(`/people/${s.payer}`))
      await page.goBack()
      await page.getByTestId('member-You').click()
      await expect(page).toHaveURL(/\/profile$/)

      await page.goto(`/groups/${s.groupId}?tab=balances`)
      const nets = page.locator(`[data-testid^="group-net-"]`).filter({hasText: s.payerName})
      const link = anchors(nets.first()).first()
      await expect(link).toBeVisible()
      await link.click()
      await expect(page).toHaveURL(new RegExp(`/people/${s.payer}`))
    })

    test('Activity: the actor avatar is its own target and does not open the row', async ({page}) => {
      await openDemo(page, '/activity')
      const row = page.getByTestId('screen-activity').last().locator('[data-testid^="activity-expense"]').first()
      await expect(row).toBeVisible({timeout: 30_000})
      // Nested: no href of its own (an anchor cannot sit in the row's), found by its label.
      const avatar = row.locator('[aria-label^="Open "]').first()
      await expectTarget(avatar)
      await avatar.click()
      await expect(page).toHaveURL(/\/(people\/[^/]+|profile)$/)
      expect(page.url()).not.toContain('/expense/')
    })

    test('People rows open the person', async ({page}) => {
      await openDemo(page, '/people')
      const s = await sample(page)
      await page.getByTestId(`person-${s.payerName}`).first().click()
      await expect(page).toHaveURL(new RegExp(`/people/${s.payer}`))
    })

    test('Settle plan: a payment avatar opens that person', async ({page}) => {
      await openDemo(page)
      const s = await sample(page)
      // The first demo group with an open plan.
      const groups = await page.evaluate(async () => (await (window as unknown as Hooks).splito.list('group')).filter(g => !g.deleted).map(g => g.id))
      const row = page.locator('[data-testid^="transfer-"]:has(a[href^="/people/"], a[href="/profile"])').first()
      for (const g of [s.groupId, ...groups]) {
        await page.goto(`/groups/${g}/settle`)
        if (await row.waitFor({state: 'visible', timeout: 6000}).then(() => true, () => false)) break
      }
      await expect(row).toBeVisible()
      const avatar = anchors(row).first()
      await expectTarget(avatar)
      await avatar.click()
      await expect(page).toHaveURL(/\/(people\/[^/]+|profile)$/)
    })

    test('an unknown person reads Not on this device yet', async ({page}) => {
      // Not in demo mode: a link to an id the demo data lacks asks to switch back first.
      await page.goto('/people/00000000-0000-4000-8000-000000000000')
      await expect(page.getByTestId('person-not-found')).toBeVisible({timeout: 30_000})
    })
  })
}

test.describe('web pointer and keyboard', () => {
  test.use({viewport: {width: 1440, height: 900}})

  test('the name underlines on hover and on keyboard focus, and Enter opens the person', async ({page}) => {
    await openDemo(page)
    const s = await sample(page)
    await page.goto(`/expense/${s.expenseId}`)
    const paid = page.getByTestId(`paid-row-${s.payerName}`)
    const name = anchors(paid).last()
    const text = name.getByText(s.payerName)
    await expect(text).toBeVisible()
    await expect(text).toHaveCSS('text-decoration-line', 'none')
    await name.hover()
    await expect(text).toHaveCSS('text-decoration-line', 'underline')
    await page.mouse.move(0, 0)
    await expect(text).toHaveCSS('text-decoration-line', 'none')
    await name.focus()
    await expect(text).toHaveCSS('text-decoration-line', 'underline')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/people/${s.payer}`))
  })
})

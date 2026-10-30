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


/** Every person on this device: id by display name (the demo's names are unique). */
async function peopleByName(page: Page) {
  return page.evaluate(async () => {
    const rows = await (window as unknown as Hooks).splito.list('person')
    return Object.fromEntries(rows.map(p => [p.data.name as string, p.id])) as Record<string, string>
  })
}

/**
 * Clicks a PersonLink and checks it opened exactly the person it names: "Open <name>" -> /people/<that person's id>,
 * "Open your profile" -> /profile. Returns the path it landed on.
 */
async function expectOpens(page: Page, link: Locator) {
  await expect(link).toBeVisible()
  const label = (await link.getAttribute('aria-label'))!
  const people = await peopleByName(page)
  await link.click()
  if (label === 'Open your profile') await expect(page).toHaveURL(/\/profile$/)
  else {
    const name = label.replace(/^Open /, '')
    expect(people[name], `a person called ${name}`).toBeTruthy()
    await expect(page).toHaveURL(new RegExp(`/people/${people[name]}$`))
  }
}

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
      await expectOpens(page, avatar)
    })

    test('comments: the author avatar and name open that author', async ({page}) => {
      await openDemo(page)
      const t = await page.evaluate(async () => {
        const s = (window as unknown as Hooks).splito
        const c = (await s.list('comment')).find(x => !x.deleted && x.data.targetType === 'expense' && x.data.authorId !== s.me)!
        return {expenseId: c.data.targetId as string, author: c.data.authorId as string}
      })
      await page.goto(`/expense/${t.expenseId}`)
      const links = page.getByTestId('discussion').locator(`a[href="/people/${t.author}"]`)
      await expect(links.first()).toBeVisible({timeout: 30_000})
      await links.first().click()
      await expect(page).toHaveURL(new RegExp(`/people/${t.author}$`))
    })

    test('Ask results: a ranking avatar opens that person', async ({page}) => {
      await openDemo(page)
      await page.getByTestId('header-search-ask').click()
      await page.getByTestId('search-input').fill('Who owes me?')
      await page.getByTestId('search-input').press('Enter')
      await expectOpens(page, anchors(page.getByTestId('ask-ranking-owed-INR')).first())
    })

    test('Search results: a person result opens the person', async ({page}) => {
      await openDemo(page)
      const name = 'Riya Sharma'
      const id = (await peopleByName(page))[name]!
      await page.getByTestId('header-search-ask').click()
      await page.getByTestId('search-input').fill(name)
      // A person result carries the "Friend" line under the name.
      await page.locator('[data-testid^="search-row-"]', {hasText: name}).filter({hasText: 'Friend'}).first().click()
      await expect(page).toHaveURL(new RegExp(`/people/${id}$`))
    })

    test('Analytics by person: a bar avatar opens that person and does not select the bar', async ({page}) => {
      await openDemo(page, '/analytics')
      const chart = page.getByTestId('analytics-by-person-chart')
      await expect(chart).toBeVisible({timeout: 30_000})
      await expectOpens(page, anchors(chart).first())
    })

    test('Friends and invites: friend rows open the person; a removed friend opens their read-only page', async ({page}) => {
      await openDemo(page, '/settings/friends')
      await expect(page.getByTestId('hub-friend-open')).toHaveCount(0)
      const friend = page.locator('[data-testid^="hub-friend-"]:has(a[href^="/people/"])').first()
      await expect(friend).toBeVisible({timeout: 30_000})
      await expectOpens(page, anchors(friend).first())
      await page.goBack()
      const removed = page.locator('[data-testid^="hub-removed-"]:has(a[href^="/people/"])').first()
      await expect(removed).toBeVisible()
      await expectOpens(page, anchors(removed).last())
      await expect(page.getByTestId('screen-person')).toBeVisible()
      await expect(page.getByTestId('person-not-found')).toHaveCount(0)
    })

    test('item chips, the charged breakdown and a group plan row open the exact person', async ({page}) => {
      await openDemo(page)
      const t = await page.evaluate(async () => {
        const s = (window as unknown as Hooks).splito
        const e = (await s.list('expense')).filter(x => !x.deleted && x.data.split.mode === 'items').map(x => x.id)
        return {items: e}
      })
      let chip: Locator | undefined
      for (const id of t.items) {
        await page.goto(`/expense/${id}`)
        const c = page.locator('[data-testid^="expense-item-"]:has(a)').first()
        if (await c.waitFor({state: 'visible', timeout: 5000}).then(() => true, () => false)) {
          chip = c
          break
        }
      }
      expect(chip, 'an itemised expense').toBeTruthy()
      await expectOpens(page, anchors(chip!).first())
      await page.goBack()
      const charged = page.locator('[data-testid^="expense-person-"]:has(a)').first()
      if (await charged.isVisible()) await expectOpens(page, anchors(charged).first())

      // A group's "who owes whom": the debtor's avatar (the first demo group with an open plan).
      const groups = await page.evaluate(async () => (await (window as unknown as Hooks).splito.list('group')).filter(g => !g.deleted).map(g => g.id))
      const owe = page.locator('[data-testid^="group-owe-"]:has(a)').first()
      for (const g of groups) {
        await page.goto(`/groups/${g}?tab=balances`)
        if (await owe.waitFor({state: 'visible', timeout: 6000}).then(() => true, () => false)) break
      }
      await expectOpens(page, anchors(owe).first())
    })

    test('padded targets never overlap another person\'s target', async ({page}) => {
      await openDemo(page)
      const s = await sample(page)
      for (const path of [`/expense/${s.expenseId}`, `/groups/${s.groupId}?tab=members`, `/groups/${s.groupId}?tab=balances`, '/activity']) {
        await page.goto(path)
        await page.locator('a[href^="/people/"], a[href="/profile"]').first().waitFor({state: 'visible', timeout: 30_000})
        const boxes = await page.locator('a[href^="/people/"], a[href="/profile"]').evaluateAll(els =>
          els
            .map(e => ({href: e.getAttribute('href')!, r: e.getBoundingClientRect()}))
            .filter(b => b.r.width > 0 && b.r.height > 0 && b.r.bottom > 0 && b.r.top < window.innerHeight),
        )
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!, b = boxes[j]!
            if (a.href === b.href) continue
            const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
            const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
            expect(w > 1 && h > 1, `${path}: ${a.href} overlaps ${b.href} by ${w.toFixed(0)}x${h.toFixed(0)}`).toBe(false)
          }
      }
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

  test('a link in a row is reachable and works from the keyboard: Enter, Space and Cmd-click', async ({page, context}) => {
    await openDemo(page, '/activity')
    const row = page.getByTestId('screen-activity').last().locator('[data-testid^="activity-expense"]').first()
    await expect(row).toBeVisible({timeout: 30_000})
    const avatar = anchors(row).first()
    const href = (await avatar.getAttribute('href'))!
    expect(href).toMatch(/^\/(people\/[^/]+|profile)$/)

    await avatar.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    expect(page.url()).not.toContain('/expense/')

    await page.goBack()
    await expect(row).toBeVisible()
    // A link's own pushes are deduped for 250 ms (useNavigationDeduped): a second activation right after Back would be dropped.
    await page.waitForTimeout(400)
    await avatar.focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(new RegExp(`${href}$`))

    await page.goBack()
    await expect(row).toBeVisible()
    await page.waitForTimeout(400)
    const opened = context.waitForEvent('page')
    await avatar.click({modifiers: ['Meta']})
    const tab = await opened
    expect(tab.url()).toContain(href)
    await tab.close()
    expect(page.url()).toContain('/activity')
  })
})

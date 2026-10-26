import {expect, type Page, test} from '@playwright/test'

const DESKTOP = {width: 1440, height: 900}
const LAPTOP = {width: 1280, height: 800}
const RAIL = {width: 900, height: 800}
const PHONE = {width: 390, height: 844}

const SIDEBAR = 240
/* Bluesky's RightNav column, shown from 1300px (owner rule 26.17). */
const RIGHT_COLUMN = 320
const TABS = ['people', 'groups', 'analytics', 'activity']
/* Top-level pages and their one header action, at the far right. */
const TOP_LEVEL: [string, string, string][] = [
  ['/', 'screen-people', 'people-add-friend'],
  ['/groups', 'screen-groups', 'groups-new'],
  ['/analytics', 'screen-analytics', 'analytics-export'],
  ['/activity', 'screen-activity', 'activity-mark-all-read'],
]

async function open(page: Page, path: string, screen: string) {
  await page.goto(path)
  await expect(page.getByTestId(screen)).toBeVisible()
}

async function openDemo(page: Page) {
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
}

/* Web keeps earlier pages of the stack mounted (hidden), so scope to the page on screen. */
function on(page: Page, screen: string, testID: string) {
  return page.getByTestId(screen).getByTestId(testID)
}

/* Activity rows are `activity-<kind>`, and every kind has a dot (`expense.created`). */
function activityRows(page: Page) {
  return page
    .getByTestId('screen-activity')
    .locator('[data-testid^="activity-"][data-testid*="."]')
}

async function box(page: Page, screen: string, testID: string) {
  return (await on(page, screen, testID).boundingBox())!
}

test('People is the initial route with no People title', async ({page}) => {
  await open(page, '/', 'screen-people')
  await expect(page.getByRole('heading', {name: 'People'})).toHaveCount(0)
})

test('logo heads the sidebar, is inactive on People and returns home elsewhere', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await open(page, '/groups', 'screen-groups')
  await page.getByTestId('logo').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('logo')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
})

test('every route in the route table resolves, including after a reload', async ({
  page,
}) => {
  const routes: [string, string][] = [
    ['/', 'screen-people'],
    ['/groups', 'screen-groups'],
    ['/analytics', 'screen-analytics'],
    ['/activity', 'screen-activity'],
    ['/profile', 'screen-profile'],
    ['/settings', 'screen-settings'],
    ['/settings/appearance', 'screen-settings-section'],
    ['/people/p1', 'screen-person'],
    ['/groups/g1', 'screen-group'],
    ['/groups/g1/settle', 'screen-settle'],
    ['/expense/new', 'screen-add-expense'],
    ['/expense/e1', 'screen-expense'],
    ['/expense/e1/edit', 'screen-edit-expense'],
    ['/friends/new', 'screen-add-friend'],
    ['/groups/new', 'screen-create-group'],
  ]
  for (const [path, screen] of routes) {
    await open(page, path, screen)
  }
  await page.reload()
  await expect(page.getByTestId('screen-create-group')).toBeVisible()
})

test('/notifications redirects to Activity', async ({page}) => {
  await open(page, '/notifications', 'screen-activity')
  await expect(page).toHaveURL(/\/activity$/)
})

test.describe('header rule set', () => {
  test('top-level pages: centred title, the one page action at the far right, no bell; the avatar opens Profile beside the full sidebar', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    for (const [path, screen, action] of TOP_LEVEL) {
      await open(page, path, screen)
      // Owner rule 26.4: the avatar at the top left at every width; with the full sidebar it opens Profile.
      await expect(on(page, screen, 'header-avatar')).toHaveAttribute(
        'aria-label',
        'Open profile',
      )
      await expect(page.getByTestId('sidebar-profile')).toHaveCount(0)
      const act = await box(page, screen, action)
      // The action's glyph sits on the right gutter (Bluesky's 3px visual offset), left of the right column.
      expect(DESKTOP.width - RIGHT_COLUMN - (act.x + act.width)).toBe(20 - 3)
      expect(act.y).toBeLessThan(20)
      // The sidebar logo sits on the header row's centre line.
      const logo = (await page.getByTestId('logo').boundingBox())!
      expect(
        Math.abs(logo.y + logo.height / 2 - (act.y + act.height / 2)),
      ).toBeLessThan(2)
      await expect(page.getByTestId('header-notifications')).toHaveCount(0)
    }
    // Titles are centred over the content.
    for (const [path, screen, name] of [
      ['/groups', 'screen-groups', 'Groups'],
      ['/activity', 'screen-activity', 'Activity'],
    ]) {
      await open(page, path, screen)
      const title = (await page
        .getByTestId(screen)
        .getByText(name, {exact: true})
        .boundingBox())!
      const centre = SIDEBAR + (DESKTOP.width - SIDEBAR - RIGHT_COLUMN) / 2
      expect(Math.abs(title.x + title.width / 2 - centre)).toBeLessThan(1)
    }
  })

  test('pushed pages: Back on the left, no avatar', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    for (const [path, screen] of [
      ['/profile', 'screen-profile'],
      ['/settings', 'screen-settings'],
      ['/people/p1', 'screen-person'],
      ['/groups/g1', 'screen-group'],
      ['/groups/g1/settle', 'screen-settle'],
      ['/expense/e1', 'screen-expense'],
      ['/settings/appearance', 'screen-settings-section'],
    ]) {
      await open(page, path, screen)
      await expect(on(page, screen, 'header-back')).toBeVisible()
      await expect(on(page, screen, 'header-avatar')).toHaveCount(0)
    }
    // Form sheets (owner rule 7) close with the cross instead of Back.
    for (const [path, screen] of [
      ['/friends/new', 'screen-add-friend'],
      ['/groups/new', 'screen-create-group'],
      ['/expense/new', 'screen-add-expense'],
    ]) {
      await open(page, path, screen)
      await expect(page.getByTestId('sheet-close')).toBeVisible()
      await expect(on(page, screen, 'header-avatar')).toHaveCount(0)
    }
  })

  test('detail pages: the name and subtitle centred, then the one action and the overflow', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await openDemo(page)
    await page.getByTestId('person-Riya Sharma').click()
    await expect(on(page, 'screen-person', 'person-name')).toHaveText(
      'Riya Sharma',
    )
    await expect(on(page, 'screen-person', 'person-byline')).toBeVisible()
    await expect(
      on(page, 'screen-person', 'person-record-payment'),
    ).toHaveAttribute('aria-label', /Settle up|Record payment/)
    await expect(on(page, 'screen-person', 'person-more')).toBeVisible()
    const title = await box(page, 'screen-person', 'person-name')
    expect(Math.abs(title.x + title.width / 2 - PHONE.width / 2)).toBeLessThan(
      2,
    )

    await open(page, '/groups', 'screen-groups')
    await on(page, 'screen-groups', 'group-Goa trip').click()
    await expect(on(page, 'screen-group', 'group-name')).toHaveText('Goa trip')
    await expect(on(page, 'screen-group', 'group-byline')).toHaveText(
      'Trip · 5 members',
    )
    await expect(on(page, 'screen-group', 'group-settle')).toBeVisible()
    await expect(on(page, 'screen-group', 'group-more')).toBeVisible()
  })

  test('on phones the header hides on scroll down and returns on scroll up', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await openDemo(page)
    await page.getByTestId('tab-activity').click()
    await expect(activityRows(page).first()).toBeVisible()
    await page.mouse.move(200, 400)
    // As upstream, the first scroll after the page's own scroll restoration is ignored.
    await page.mouse.wheel(0, 400)
    await page.mouse.wheel(0, 400)
    await expect
      .poll(async () => (await box(page, 'screen-activity', 'header-avatar')).y)
      .toBeLessThan(0)
    await page.mouse.wheel(0, -100)
    await expect
      .poll(async () => (await box(page, 'screen-activity', 'header-avatar')).y)
      .toBeGreaterThanOrEqual(0)
  })

  test('on desktop the header stays put', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await openDemo(page)
    await page.getByTestId('tab-activity').click()
    await expect(activityRows(page).first()).toBeVisible()
    await page.mouse.move(700, 400)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(600)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400)
    expect(
      (await box(page, 'screen-activity', 'activity-mark-all-read')).y,
    ).toBeGreaterThanOrEqual(0)
  })
})

test.describe('drawer: Bluesky drawer from the header avatar', () => {
  test('slides in from the left with the account card, the rows and the footer', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await openDemo(page)
    await on(page, 'screen-people', 'header-avatar').click()
    const drawer = page.getByTestId('drawer')
    await expect(drawer).toBeVisible()
    await expect.poll(async () => (await drawer.boundingBox())!.x).toBe(0)
    await expect(page.getByTestId('drawer-profile')).toContainText(
      'Saved on this device',
    )
    await expect(page.getByTestId('drawer-profile')).toContainText(
      '6 friends · 3 groups',
    )
    const rows = await drawer
      .locator('[data-testid^="drawer-"]')
      .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
    expect(rows).toEqual([
      'drawer-profile',
      'drawer-people',
      'drawer-groups',
      'drawer-analytics',
      'drawer-activity',
      'drawer-search',
      'drawer-profile-item',
      'drawer-settings',
      'drawer-theme',
      'drawer-sign-in',
      'drawer-help',
      'drawer-about',
    ])
    // Escape closes it (focus is trapped inside while it's open).
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
  })

  test('the scrim closes it; rows navigate and close it', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/', 'screen-people')
    await on(page, 'screen-people', 'header-avatar').click()
    await expect(page.getByTestId('drawer')).toBeVisible()
    await page.mouse.click(PHONE.width - 10, PHONE.height / 2)
    await expect(page.getByTestId('drawer')).toHaveCount(0)

    for (const [row, screen, url] of [
      ['drawer-groups', 'screen-groups', /\/groups$/],
      ['drawer-profile-item', 'screen-profile', /\/profile$/],
      ['drawer-settings', 'screen-settings', /\/settings$/],
      ['drawer-activity', 'screen-activity', /\/activity$/],
      ['drawer-about', 'screen-settings-section', /\/settings\/about$/],
    ] as const) {
      await open(page, '/analytics', 'screen-analytics')
      await on(page, 'screen-analytics', 'header-avatar').click()
      await page.getByTestId(row).click()
      await expect(page).toHaveURL(url)
      await expect(page.getByTestId(screen)).toBeVisible()
      await expect(page.getByTestId('drawer')).toHaveCount(0)
    }
  })

  test('the dark theme switch sets the theme preference', async ({page}) => {
    await page.setViewportSize(RAIL)
    await open(page, '/groups', 'screen-groups')
    await expect(page.locator('html')).toHaveClass(/theme--light/)
    await on(page, 'screen-groups', 'header-avatar').click()
    await page.getByTestId('drawer-theme').click()
    await expect(page.locator('html')).toHaveClass(/theme--dim/)
    // It's the `theme` preference, so it survives a reload.
    await page.reload()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await expect(page.locator('html')).toHaveClass(/theme--dim/)
    await on(page, 'screen-groups', 'header-avatar').click()
    await expect(page.getByTestId('drawer-theme')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.getByTestId('drawer-theme').click()
    await expect(page.locator('html')).toHaveClass(/theme--light/)
  })
})

test.describe("activity: a tab with Bluesky's unread badge", () => {
  test('the badge counts unread changes from others; Mark all read clears it', async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP)
    await openDemo(page)
    const badge = page.getByTestId('nav-badge-activity')
    await expect(badge).toHaveText(/^\d+$/)
    const unread = Number(await badge.innerText())
    expect(unread).toBeGreaterThan(0)
    await expect(badge).toHaveAttribute('aria-label', `${unread} unread items`)
    await page.getByTestId('tab-activity').click()
    await expect(page).toHaveURL(/\/activity$/)
    await expect(page.getByTestId('screen-activity')).toBeVisible()
    await expect(page.getByTestId('tab-activity')).toHaveAttribute(
      'aria-current',
      'page',
    )

    // "From others" drops your own changes; the badge counted exactly those.
    const rows = activityRows(page)
    const all = await rows.count()
    await page.getByTestId('activity-tabs-selector-1').click()
    await expect(page.getByTestId('activity-tabs-selector-1')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect.poll(() => rows.count()).toBe(unread)
    expect(unread).toBeLessThan(all)
    await expect(rows.filter({hasText: 'You added'})).toHaveCount(0)

    // Mark all read clears the badge, and it stays cleared after a reload.
    await page.getByTestId('activity-mark-all-read').click()
    await expect(page.getByTestId('activity-mark-all-read')).toBeDisabled()
    await expect(page.getByTestId('nav-badge-activity')).toHaveCount(0)
    await page.reload()
    await expect(rows.first()).toBeVisible()
    await expect(page.getByTestId('nav-badge-activity')).toHaveCount(0)
  })

  test('on phones the bottom bar carries the badge', async ({page}) => {
    await page.setViewportSize(PHONE)
    await openDemo(page)
    await expect(page.getByTestId('nav-badge-activity')).toHaveText(/^\d+$/)
    await page.getByTestId('tab-activity').click()
    await expect(page).toHaveURL(/\/activity$/)
    await expect(page.getByTestId('screen-activity')).toBeVisible()
  })
})

test.describe('desktop: Bluesky left sidebar and full-width content', () => {
  test('labelled nav with Activity, the Add expense pill, no FAB, no bottom bar', async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/', 'screen-people')
    const items = await page.getByRole('navigation').locator('[data-testid^="tab-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
    expect(items).toEqual(['tab-people', 'tab-groups', 'tab-analytics', 'tab-activity', 'tab-search', 'tab-settings'])
    await expect(page.getByTestId('tab-people')).toContainText('Home')
    // The sidebar already shows the mark, so the home header shows its title (26.4).
    await expect(on(page, 'screen-people', 'header-logo')).toHaveCount(0)
    await expect(page.getByTestId('screen-people').getByText('Home', {exact: true})).toBeVisible()
    await expect(page.getByTestId('tab-people')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByTestId('sidebar-add')).toContainText('Add expense')
    await expect(page.getByTestId('fab-add')).toHaveCount(0)
  })

  test('content fills the space between the sidebar and the right column', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await open(page, '/groups', 'screen-groups')
    const box = (await page.getByTestId('screen-groups').boundingBox())!
    expect(box.x).toBe(SIDEBAR)
    expect(box.width).toBe(DESKTOP.width - SIDEBAR - RIGHT_COLUMN)
    // Below 1300px the right column hides and the content takes its place.
    await page.setViewportSize(LAPTOP)
    await expect(page.getByTestId('right-nav')).toHaveCount(0)
    await expect
      .poll(
        async () =>
          (await page.getByTestId('screen-groups').boundingBox())!.width,
      )
      .toBe(LAPTOP.width - SIDEBAR)
  })

  test('the sidebar holds only the mark, the nav and Add expense; no wordmark, account card or footer', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await openDemo(page)
    const nav = page.getByRole('navigation')
    const order = ['logo', 'tab-people', 'tab-settings', 'sidebar-add']
    const ys: number[] = []
    for (const id of order)
      ys.push((await nav.getByTestId(id).boundingBox())!.y)
    expect([...ys].sort((x, y) => x - y)).toEqual(ys)
    await expect(page.getByTestId('logo-wordmark')).toHaveCount(0)
    for (const gone of ['sidebar-profile', 'sidebar-footer', 'sidebar-help'])
      await expect(nav.getByTestId(gone)).toHaveCount(0)
    // The mark is centred in the sidebar column.
    const logo = (await nav.getByTestId('logo').boundingBox())!
    expect(Math.abs(logo.x + logo.width / 2 - SIDEBAR / 2)).toBeLessThan(2)
    // The sidebar is the window's full height with a hairline on its right.
    const sidebar = (await nav.boundingBox())!
    expect(sidebar.height).toBe(DESKTOP.height)
    expect(
      await nav.evaluate(el => getComputedStyle(el).borderRightWidth),
    ).toBe('1px')
  })

  test('the mark takes the accent, in Dim too', async ({page}) => {
    await page.setViewportSize(DESKTOP)
    await page.emulateMedia({colorScheme: 'dark'})
    await open(page, '/', 'screen-people')
    await expect(page.locator('html')).toHaveClass(/theme--dim/)
    const fill = await page
      .getByTestId('logo')
      .locator('path')
      .first()
      .getAttribute('fill')
    const pill = await page
      .getByTestId('sidebar-add')
      .evaluate(el => getComputedStyle(el).backgroundColor)
    const hex = (fill ?? '').replace('#', '')
    const rgb = `rgb(${[0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
    expect(rgb).toBe(pill)
  })

  test('the right column lists recent groups with my balance, and See all opens Groups', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await openDemo(page)
    const recent = page
      .getByTestId('right-nav')
      .getByTestId('sidebar-recent-groups')
    await expect(recent).toContainText('Recently active groups')
    await expect(recent.getByTestId('sidebar-group-Goa trip')).toBeVisible()
    await expect(
      recent.getByTestId('sidebar-group-balance-Goa trip'),
    ).toHaveText(/^\+₹/)
    await expect(recent.getByTestId('sidebar-group-balance-Lisbon')).toHaveText(
      /^−€/,
    )
    expect(
      await recent.locator('[data-testid^="sidebar-group-"][href]').count(),
    ).toBeLessThanOrEqual(5)
    await recent.getByTestId('sidebar-group-Goa trip').click()
    await expect(page.getByTestId('screen-group')).toBeVisible()
    await page.getByTestId('sidebar-groups-all').click()
    await expect(page).toHaveURL(/\/groups$/)
  })

  test('a bar beside the active item moves to the item picked', async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/', 'screen-people')
    const centreY = async (id: string) => {
      const b = (await page.getByTestId(id).boundingBox())!
      return Math.round(b.y + b.height / 2)
    }
    await expect
      .poll(() => centreY('sidebar-indicator'))
      .toBe(await centreY('tab-people'))
    expect((await page.getByTestId('sidebar-indicator').boundingBox())!.x).toBe(
      0,
    )
    await page.getByTestId('tab-analytics').click()
    await expect
      .poll(() => centreY('sidebar-indicator'))
      .toBe(await centreY('tab-analytics'))
  })

  test('800-999px is an icon rail without labels', async ({page}) => {
    await page.setViewportSize(RAIL)
    await openDemo(page)
    await expect(page.getByTestId('tab-groups')).toBeVisible()
    await expect(page.getByTestId('tab-groups')).not.toContainText('Groups')
    await expect(page.getByTestId('sidebar-add')).toBeVisible()
    // Bluesky's minimal mode: the mark, icons, the round pill; the header avatar opens the drawer.
    await expect(page.getByTestId('logo')).toBeVisible()
    await expect(page.getByTestId('logo-wordmark')).toHaveCount(0)
    await expect(on(page, 'screen-people', 'header-avatar')).toHaveAttribute(
      'aria-label',
      'Open menu',
    )
    await expect(page.getByTestId('sidebar-recent-groups')).toHaveCount(0)
    await expect(page.getByTestId('sidebar-footer')).toHaveCount(0)
    const box = (await page.getByTestId('screen-people').boundingBox())!
    expect(box.x).toBe(80)
  })

  test('the pill opens Add expense as a dialog over the page; Escape closes it', async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/groups', 'screen-groups')
    await page.getByTestId('sidebar-add').click()
    await expect(page).toHaveURL(/\/expense\/new$/)
    await expect(page.getByRole('dialog')).toBeVisible()
    // Measure once the popup's scale-in (0.96 to 1, owner rule 18) has settled.
    const dialogBox = page.getByTestId('screen-add-expense')
    await expect
      .poll(async () => {
        const before = (await dialogBox.boundingBox())!.width
        await page.waitForTimeout(50)
        return (await dialogBox.boundingBox())!.width === before
      })
      .toBe(true)
    // One sheet layout: the close cross at the top right, Cancel then Save at the bottom right.
    const close = (await page.getByTestId('sheet-close').boundingBox())!
    const cancel = (await page.getByTestId('sheet-cancel').boundingBox())!
    const save = (await page.getByTestId('sheet-save').boundingBox())!
    const dialog = (await page.getByTestId('screen-add-expense').boundingBox())!
    expect(close.x + close.width).toBeGreaterThan(dialog.x + dialog.width - 24)
    expect(close.y).toBeLessThan(dialog.y + 24)
    expect(save.y + save.height).toBeGreaterThan(dialog.y + dialog.height - 24)
    expect(save.x + save.width).toBeGreaterThan(dialog.x + dialog.width - 24)
    expect(cancel.x + cancel.width).toBeLessThan(save.x)
    // The page underneath stays rendered, as under Bluesky's composer.
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/groups$/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('a pushed page keeps its section lit, as Bluesky tabs stay lit under a pushed screen', async ({
    page,
  }) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/people/p1', 'screen-person')
    await expect(page.getByTestId('tab-people')).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('Settings is a sidebar item', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/', 'screen-people')
    await page.getByTestId('tab-settings').click()
    await expect(page.getByTestId('screen-settings')).toBeVisible()
    await expect(page.getByTestId('tab-settings')).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

test.describe('phone: Bluesky bottom bar and FAB', () => {
  test('four tabs with Activity, no Profile tab, no centre button, the FAB, no sidebar', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await openDemo(page)
    const items = await page
      .getByRole('navigation')
      .locator('[data-testid^="tab-"]')
      .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
    expect(items).toEqual(TABS.map(tab => `tab-${tab}`))
    await expect(page.getByTestId('sidebar-add')).toHaveCount(0)
    const fab = page.getByTestId('fab-add')
    await expect(fab).toBeVisible()
    await expect(fab).toHaveAttribute('aria-label', 'Add expense')
    // Bottom-right, above the bottom bar.
    const box = (await fab.boundingBox())!
    expect(box.x + box.width).toBeGreaterThan(PHONE.width - 40)
    expect(box.width).toBe(56)
    const bar = (await page.getByRole('navigation').boundingBox())!
    expect(box.y + box.height).toBeLessThan(bar.y)
  })

  test('the FAB is on every top-level page (Analytics too), not on empty People', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    // Empty People has its own Add a friend / Add expense buttons, so no third Add.
    await open(page, '/', 'screen-people')
    await expect(page.getByTestId('people-empty')).toBeVisible()
    await expect(on(page, 'screen-people', 'fab-add')).toHaveCount(0)
    await openDemo(page)
    for (const [path, screen] of [
      ['/?demo=1', 'screen-people'],
      ['/groups', 'screen-groups'],
      ['/activity', 'screen-activity'],
    ]) {
      await open(page, path, screen)
      await expect(on(page, screen, 'fab-add')).toBeVisible()
    }
    // Owner rule 26.6: every page without Back has the FAB on phones.
    await open(page, '/analytics', 'screen-analytics')
    await expect(on(page, 'screen-analytics', 'fab-add')).toBeVisible()
  })

  test('the composer is a sheet over the page: full width, from the bottom edge, below a strip of the page', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await open(page, '/expense/new', 'screen-add-expense')
    await page.waitForTimeout(500)
    const box = (await page.getByTestId('screen-add-expense').boundingBox())!
    expect(box.width).toBe(PHONE.width)
    expect(Math.round(box.y + box.height)).toBe(PHONE.height)
    expect(box.y).toBeGreaterThanOrEqual(40)
  })

  test('the FAB opens Add expense like the composer; the close cross returns', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await openDemo(page)
    await page.getByTestId('fab-add').click()
    await expect(page).toHaveURL(/\/expense\/new$/)
    await expect(page.getByTestId('screen-add-expense')).toBeVisible()
    await page.getByTestId('sheet-close').click()
    await expect(page).toHaveURL(/\/(\?demo=1)?$/)
    await expect(page.getByTestId('screen-add-expense')).toHaveCount(0)
  })

  test("the avatar is in Bluesky's hamburger spot at the top left; the logo stays centred", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    for (const [path, screen] of TOP_LEVEL) {
      await open(page, path, screen)
      const avatar = await box(page, screen, 'header-avatar')
      // On the 16px phone gutter.
      expect(avatar.x).toBe(16)
      expect(avatar.y).toBeLessThan(20)
    }
    await open(page, '/', 'screen-people')
    const logo = await box(page, 'screen-people', 'header-logo')
    expect(Math.abs(logo.x + logo.width / 2 - PHONE.width / 2)).toBeLessThan(1)
  })

  test('tabs navigate; Profile and Settings open from the drawer', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await open(page, '/', 'screen-people')
    await page.getByTestId('tab-groups').click()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.getByTestId('tab-activity').click()
    await expect(page.getByTestId('screen-activity')).toBeVisible()
    await page.getByTestId('tab-analytics').click()
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await on(page, 'screen-analytics', 'header-avatar').click()
    await page.getByTestId('drawer-profile').click()
    await expect(page.getByTestId('screen-profile')).toBeVisible()
    await page.getByTestId('profile-settings').click()
    await expect(page.getByTestId('screen-settings')).toBeVisible()
  })
})

test('the tabs preference orders and hides tabs; hidden routes still open', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await open(page, '/', 'screen-people')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(() =>
    (window as any).splito.setPref('tabs', ['groups', 'people']),
  )
  await expect(page.getByTestId('tab-analytics')).toHaveCount(0)
  const order = await page
    .getByRole('navigation')
    .locator('[data-testid^="tab-"]')
    .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(order).toEqual(['tab-groups', 'tab-people'])
  // Hiding tabs never strands anything: the drawer still reaches every page.
  await on(page, 'screen-people', 'header-avatar').click()
  await page.getByTestId('drawer-analytics').click()
  await expect(page.getByTestId('screen-analytics')).toBeVisible()

  await page.setViewportSize(LAPTOP)
  await expect(page.getByTestId('tab-analytics')).toHaveCount(0)
  await expect(page.getByTestId('tab-settings')).toBeVisible()
  await open(page, '/analytics', 'screen-analytics')
})

test('dev tools seed data in e2e builds', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  const id = await page.evaluate(() =>
    (window as any).splito.createPerson('Riya'),
  )
  expect(typeof id).toBe('string')
})

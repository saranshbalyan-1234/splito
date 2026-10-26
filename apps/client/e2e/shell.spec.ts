import {expect, type Page, test} from '@playwright/test'

const DESKTOP = {width: 1440, height: 900}
const LAPTOP = {width: 1280, height: 800}
const RAIL = {width: 900, height: 800}
const PHONE = {width: 390, height: 844}

const SIDEBAR = 240
const TABS = ['people', 'groups', 'analytics']
/* Top-level pages and their one header action, which sits just left of the bell. */
const TOP_LEVEL: [string, string, string][] = [
  ['/', 'screen-people', 'people-add-friend'],
  ['/groups', 'screen-groups', 'groups-new'],
  ['/analytics', 'screen-analytics', 'analytics-export'],
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

async function box(page: Page, screen: string, testID: string) {
  return (await on(page, screen, testID).boundingBox())!
}

test('People is the initial route with no People title', async ({page}) => {
  await open(page, '/', 'screen-people')
  await expect(page.getByRole('heading', {name: 'People'})).toHaveCount(0)
})

test('logo heads the sidebar, is inactive on People and returns home elsewhere', async ({page}) => {
  await page.setViewportSize(LAPTOP)
  await open(page, '/groups', 'screen-groups')
  await page.getByTestId('logo').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('logo')).toHaveAttribute('aria-disabled', 'true')
})

test('every route in the route table resolves, including after a reload', async ({page}) => {
  const routes: [string, string][] = [
    ['/', 'screen-people'],
    ['/groups', 'screen-groups'],
    ['/notifications', 'screen-notifications'],
    ['/analytics', 'screen-analytics'],
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

test('/activity redirects to Notifications', async ({page}) => {
  await open(page, '/activity', 'screen-notifications')
  await expect(page).toHaveURL(/\/notifications$/)
})

test.describe('header rule set', () => {
  test('top-level pages: avatar left, centred title, the page action then the bell at the far right', async ({page}) => {
    await page.setViewportSize(DESKTOP)
    for (const [path, screen, action] of TOP_LEVEL) {
      await open(page, path, screen)
      const avatar = await box(page, screen, 'header-avatar')
      // The avatar sits on the 20px desktop gutter, left of the title, in the header row.
      expect(avatar.x - SIDEBAR).toBe(20)
      expect(avatar.y).toBeLessThan(20)
      const bell = await box(page, screen, 'header-notifications')
      const act = await box(page, screen, action)
      // The bell's glyph sits on the right gutter (Bluesky's 3px visual offset).
      expect(DESKTOP.width - (bell.x + bell.width)).toBe(20 - 3)
      expect(act.x + act.width).toBeLessThanOrEqual(bell.x)
      expect(bell.x - (act.x + act.width)).toBeLessThan(16)
      expect(Math.abs(act.y - bell.y)).toBeLessThan(1)
    }
    // Groups' title is centred over the content, not pushed by the two icons on the right.
    await open(page, '/groups', 'screen-groups')
    const title = (await page.getByTestId('screen-groups').getByText('Groups', {exact: true}).boundingBox())!
    const centre = SIDEBAR + (DESKTOP.width - SIDEBAR) / 2
    expect(Math.abs(title.x + title.width / 2 - centre)).toBeLessThan(1)
  })

  test('pushed pages: Back on the left, no avatar, no bell', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    for (const [path, screen] of [
      ['/notifications', 'screen-notifications'],
      ['/profile', 'screen-profile'],
      ['/settings', 'screen-settings'],
      ['/people/p1', 'screen-person'],
      ['/groups/g1', 'screen-group'],
      ['/friends/new', 'screen-add-friend'],
    ]) {
      await open(page, path, screen)
      await expect(on(page, screen, 'header-back')).toBeVisible()
      await expect(on(page, screen, 'header-avatar')).toHaveCount(0)
      await expect(on(page, screen, 'header-notifications')).toHaveCount(0)
    }
  })

  test('on phones the header hides on scroll down and returns on scroll up', async ({page}) => {
    await page.setViewportSize(PHONE)
    await openDemo(page)
    await on(page, 'screen-people', 'header-notifications').click()
    await expect(page.getByTestId('notification-row').first()).toBeVisible()
    await page.mouse.move(200, 400)
    // As upstream, the first scroll after the page's own scroll restoration is ignored.
    await page.mouse.wheel(0, 400)
    await page.mouse.wheel(0, 400)
    await expect.poll(async () => (await box(page, 'screen-notifications', 'header-back')).y).toBeLessThan(0)
    await page.mouse.wheel(0, -100)
    await expect.poll(async () => (await box(page, 'screen-notifications', 'header-back')).y).toBeGreaterThanOrEqual(0)
  })

  test('on desktop the header stays put', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await openDemo(page)
    await on(page, 'screen-people', 'header-notifications').click()
    await expect(page.getByTestId('notification-row').first()).toBeVisible()
    await page.mouse.move(700, 400)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(600)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400)
    expect((await box(page, 'screen-notifications', 'header-back')).y).toBeGreaterThanOrEqual(0)
  })
})

test.describe('drawer: Bluesky drawer from the header avatar', () => {
  test('slides in from the left with the account card, the rows and the footer', async ({page}) => {
    await page.setViewportSize(DESKTOP)
    await openDemo(page)
    await on(page, 'screen-people', 'header-avatar').click()
    const drawer = page.getByTestId('drawer')
    await expect(drawer).toBeVisible()
    await expect.poll(async () => (await drawer.boundingBox())!.x).toBe(0)
    await expect(page.getByTestId('drawer-profile')).toContainText('Saved on this device')
    await expect(page.getByTestId('drawer-profile')).toContainText('6 friends · 3 groups')
    const rows = await drawer.locator('[data-testid^="drawer-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
    expect(rows).toEqual([
      'drawer-profile',
      'drawer-people',
      'drawer-groups',
      'drawer-analytics',
      'drawer-profile-item',
      'drawer-settings',
      'drawer-notifications',
      'drawer-theme',
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
      ['drawer-notifications', 'screen-notifications', /\/notifications$/],
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
    await page.setViewportSize(LAPTOP)
    await open(page, '/groups', 'screen-groups')
    await expect(page.locator('html')).toHaveClass(/theme--light/)
    await on(page, 'screen-groups', 'header-avatar').click()
    await page.getByTestId('drawer-theme').click()
    await expect(page.locator('html')).toHaveClass(/theme--dark/)
    // It's the `theme` preference, so it survives a reload.
    await page.reload()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await expect(page.locator('html')).toHaveClass(/theme--dark/)
    await on(page, 'screen-groups', 'header-avatar').click()
    await expect(page.getByTestId('drawer-theme')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('drawer-theme').click()
    await expect(page.locator('html')).toHaveClass(/theme--light/)
  })
})

test.describe('notifications: the header bell', () => {
  test('the bell counts unread changes from others and opens Notifications', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await openDemo(page)
    const badge = on(page, 'screen-people', 'header-notifications-badge')
    await expect(badge).toHaveText(/^\d+$/)
    const unread = Number(await badge.innerText())
    expect(unread).toBeGreaterThan(0)
    await on(page, 'screen-people', 'header-notifications').click()
    await expect(page).toHaveURL(/\/notifications$/)
    await expect(page.getByTestId('screen-notifications')).toBeVisible()

    // "From others" drops your own changes; the badge counted exactly those.
    const rows = page.getByTestId('screen-notifications').getByTestId('notification-row')
    const all = await rows.count()
    await page.getByTestId('notifications-tabs-1').click()
    await expect(page.getByTestId('notifications-tabs-1')).toHaveAttribute('aria-selected', 'true')
    await expect.poll(() => rows.count()).toBe(unread)
    expect(unread).toBeLessThan(all)
    await expect(rows.filter({hasText: 'You added'})).toHaveCount(0)

    // Mark all read clears the badge everywhere, and stays cleared after a reload.
    await page.getByTestId('notifications-mark-read').click()
    await expect(page.getByTestId('notifications-mark-read')).toBeDisabled()
    await on(page, 'screen-notifications', 'header-back').click()
    await expect(page.getByTestId('screen-people')).toBeVisible()
    await expect(on(page, 'screen-people', 'header-notifications-badge')).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
    await expect(on(page, 'screen-people', 'header-notifications-badge')).toHaveCount(0)
  })

  test('the bell is on every top-level page, on phones too', async ({page}) => {
    await page.setViewportSize(PHONE)
    for (const [path, screen] of TOP_LEVEL) {
      await open(page, path, screen)
      const bell = await box(page, screen, 'header-notifications')
      expect(PHONE.width - (bell.x + bell.width)).toBe(16 - 3)
      expect(bell.y).toBeLessThan(20)
    }
    await on(page, 'screen-analytics', 'header-notifications').click()
    await expect(page.getByTestId('screen-notifications')).toBeVisible()
  })
})

test.describe('desktop: Bluesky left sidebar and full-width content', () => {
  test('labelled nav without Activity, the Add expense pill, no FAB, no bottom bar', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/', 'screen-people')
    const items = await page.getByRole('navigation').locator('[data-testid^="tab-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
    expect(items).toEqual(['tab-people', 'tab-groups', 'tab-analytics', 'tab-settings'])
    await expect(page.getByTestId('tab-people')).toContainText('People')
    await expect(page.getByTestId('tab-people')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('sidebar-add')).toContainText('Add expense')
    await expect(page.getByTestId('tab-activity')).toHaveCount(0)
    await expect(page.getByTestId('sidebar-account')).toHaveCount(0)
    await expect(page.getByTestId('fab-add')).toHaveCount(0)
  })

  test('content fills the window beside the sidebar (no centred column)', async ({page}) => {
    await page.setViewportSize(DESKTOP)
    await open(page, '/groups', 'screen-groups')
    const box = (await page.getByTestId('screen-groups').boundingBox())!
    expect(box.x).toBe(SIDEBAR)
    expect(box.width).toBe(DESKTOP.width - SIDEBAR)
  })

  test('800-999px is an icon rail without labels', async ({page}) => {
    await page.setViewportSize(RAIL)
    await open(page, '/', 'screen-people')
    await expect(page.getByTestId('tab-groups')).toBeVisible()
    await expect(page.getByTestId('tab-groups')).not.toContainText('Groups')
    await expect(page.getByTestId('sidebar-add')).toBeVisible()
    const box = (await page.getByTestId('screen-people').boundingBox())!
    expect(box.x).toBe(80)
  })

  test('the pill opens Add expense as a dialog over the page; Escape closes it', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/groups', 'screen-groups')
    await page.getByTestId('sidebar-add').click()
    await expect(page).toHaveURL(/\/expense\/new$/)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('composer-cancel')).toBeVisible()
    await expect(page.getByTestId('composer-save')).toBeVisible()
    // The page underneath stays rendered, as under Bluesky's composer.
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/groups$/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('Settings is a sidebar item', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/', 'screen-people')
    await page.getByTestId('tab-settings').click()
    await expect(page.getByTestId('screen-settings')).toBeVisible()
    await expect(page.getByTestId('tab-settings')).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('phone: Bluesky bottom bar and FAB', () => {
  test('three tabs, no Activity or Profile tab, no centre button, the FAB, no sidebar', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/', 'screen-people')
    const items = await page.getByRole('navigation').locator('[data-testid^="tab-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
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

  test('the FAB opens Add expense like the composer; Cancel returns', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/', 'screen-people')
    await page.getByTestId('fab-add').click()
    await expect(page).toHaveURL(/\/expense\/new$/)
    await expect(page.getByTestId('screen-add-expense')).toBeVisible()
    await page.getByTestId('composer-cancel').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('screen-add-expense')).toHaveCount(0)
  })

  test("the avatar is in Bluesky's hamburger spot at the top left; the logo stays centred", async ({page}) => {
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

  test('tabs navigate; Profile and Settings open from the drawer', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/', 'screen-people')
    await page.getByTestId('tab-groups').click()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.getByTestId('tab-analytics').click()
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await on(page, 'screen-analytics', 'header-avatar').click()
    await page.getByTestId('drawer-profile').click()
    await expect(page.getByTestId('screen-profile')).toBeVisible()
    await page.getByTestId('profile-settings').click()
    await expect(page.getByTestId('screen-settings')).toBeVisible()
  })
})

test('the tabs preference orders and hides tabs; hidden routes still open', async ({page}) => {
  await page.setViewportSize(PHONE)
  await open(page, '/', 'screen-people')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(() => (window as any).splito.setPref('tabs', ['groups', 'people']))
  await expect(page.getByTestId('tab-analytics')).toHaveCount(0)
  const order = await page.getByRole('navigation').locator('[data-testid^="tab-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
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
  const id = await page.evaluate(() => (window as any).splito.createPerson('Riya'))
  expect(typeof id).toBe('string')
})

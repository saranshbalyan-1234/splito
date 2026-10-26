import {expect, type Page, test} from '@playwright/test'

const DESKTOP = {width: 1440, height: 900}
const LAPTOP = {width: 1280, height: 800}
const RAIL = {width: 900, height: 800}
const PHONE = {width: 390, height: 844}

const TABS = ['people', 'groups', 'analytics', 'activity']
const TOP_LEVEL: [string, string][] = [
  ['/', 'screen-people'],
  ['/groups', 'screen-groups'],
  ['/analytics', 'screen-analytics'],
  ['/activity', 'screen-activity'],
]

async function open(page: Page, path: string, screen: string) {
  await page.goto(path)
  await expect(page.getByTestId(screen)).toBeVisible()
}

/* Web keeps earlier pages of the stack mounted (hidden), so scope to the page on screen. */
function avatarOn(page: Page, screen: string) {
  return page.getByTestId(screen).getByTestId('header-avatar')
}

test('People is the initial route; phones head it with the logo, not a title', async ({page}) => {
  await page.setViewportSize(PHONE)
  await open(page, '/', 'screen-people')
  await expect(page.getByTestId('screen-people').getByTestId('logo')).toBeVisible()
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
    ['/activity', 'screen-activity'],
    ['/notifications', 'screen-activity'],
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

test.describe('desktop: Bluesky left sidebar and full-width content', () => {
  test('labelled nav, the Add expense pill, no FAB, no bottom bar', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/', 'screen-people')
    for (const tab of [...TABS, 'settings']) {
      await expect(page.getByTestId(`tab-${tab}`)).toBeVisible()
    }
    await expect(page.getByTestId('tab-people')).toContainText('People')
    await expect(page.getByTestId('tab-people')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('sidebar-add')).toContainText('Add expense')
    // Profile and the account card left the sidebar for the header avatar; there is no header bell.
    await expect(page.getByTestId('tab-profile')).toHaveCount(0)
    await expect(page.getByTestId('sidebar-account')).toHaveCount(0)
    await expect(page.getByTestId('header-notifications')).toHaveCount(0)
    await expect(page.getByTestId('fab-add')).toHaveCount(0)
  })

  test('every top-level header: centred title, then the action and the avatar at the top right', async ({page}) => {
    await page.setViewportSize(DESKTOP)
    for (const [path, screen] of TOP_LEVEL) {
      await open(page, path, screen)
      const avatar = (await avatarOn(page, screen).boundingBox())!
      // 32px avatar in a 4px halo; the avatar itself sits on the 20px desktop gutter, in the header row.
      expect(avatar.width).toBe(40)
      expect(DESKTOP.width - (avatar.x + avatar.width)).toBe(20 - 4)
      expect(avatar.y).toBeLessThan(20)
    }
    // The sidebar has the logo, so the desktop People header has its title.
    await open(page, '/', 'screen-people')
    await expect(page.getByTestId('screen-people').getByText('People', {exact: true})).toBeVisible()
    // Pushed pages have a back button instead, and no avatar.
    await open(page, '/settings', 'screen-settings')
    await expect(avatarOn(page, 'screen-settings')).toHaveCount(0)
  })

  test('the avatar menu opens Profile, Settings and Analytics and switches the theme', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/groups', 'screen-groups')
    await avatarOn(page, 'screen-groups').click()
    for (const item of ['profile', 'settings', 'analytics', 'theme']) {
      await expect(page.getByTestId(`header-menu-${item}`)).toBeVisible()
    }
    // A dropdown under the avatar, its right edge on the avatar's (the gutter), clear of the header; no drawer.
    const menu = (await page.getByTestId('header-menu-profile').boundingBox())!
    expect(menu.x + menu.width).toBeGreaterThan(LAPTOP.width - 40)
    const account = (await page.getByTestId('header-menu-account').boundingBox())!
    expect(account.y).toBeGreaterThan(52)
    await expect(page.getByTestId('drawer')).toHaveCount(0)
    await page.getByTestId('header-menu-profile').click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByTestId('screen-profile')).toBeVisible()
    await page.goBack()
    await expect(page.getByTestId('screen-groups')).toBeVisible()

    // Escape closes it.
    await avatarOn(page, 'screen-groups').click()
    await expect(page.getByTestId('header-menu-settings')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('header-menu-settings')).toHaveCount(0)

    await avatarOn(page, 'screen-groups').click()
    await page.getByTestId('header-menu-settings').click()
    await expect(page.getByTestId('screen-settings')).toBeVisible()

    await open(page, '/', 'screen-people')
    await avatarOn(page, 'screen-people').click()
    await page.getByTestId('header-menu-analytics').click()
    await expect(page.getByTestId('screen-analytics')).toBeVisible()

    await expect(page.locator('html')).toHaveClass(/theme--light/)
    await avatarOn(page, 'screen-analytics').click()
    await expect(page.getByTestId('header-menu-theme')).toContainText('Dark theme')
    await page.getByTestId('header-menu-theme').click()
    await expect(page.locator('html')).toHaveClass(/theme--dark/)
    // The shortcut is the `theme` preference, so it survives a reload.
    await page.reload()
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await expect(page.locator('html')).toHaveClass(/theme--dark/)
    await avatarOn(page, 'screen-analytics').click()
    await expect(page.getByTestId('header-menu-theme')).toContainText('Light theme')
    await page.getByTestId('header-menu-theme').click()
    await expect(page.locator('html')).toHaveClass(/theme--light/)
  })

  test('Activity is a sidebar item with the unread badge; pushed pages keep their section lit', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/groups', 'screen-groups')
    await page.getByTestId('tab-activity').click()
    await expect(page).toHaveURL(/\/activity$/)
    await expect(page.getByTestId('screen-activity')).toBeVisible()
    await expect(page.getByTestId('tab-activity')).toHaveAttribute('aria-current', 'page')
    // A friend's page lights People, as Bluesky's tab stays lit under a pushed screen.
    await open(page, '/people/p1', 'screen-person')
    await expect(page.getByTestId('tab-people')).toHaveAttribute('aria-current', 'page')
  })

  test('content fills the window beside the sidebar (no centred column)', async ({page}) => {
    await page.setViewportSize(DESKTOP)
    await open(page, '/groups', 'screen-groups')
    const box = (await page.getByTestId('screen-groups').boundingBox())!
    expect(box.x).toBe(240)
    expect(box.width).toBe(DESKTOP.width - 240)
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

  test('Settings is a sidebar item', async ({page}) => {
    await page.setViewportSize(LAPTOP)
    await open(page, '/', 'screen-people')
    await page.getByTestId('tab-settings').click()
    await expect(page.getByTestId('screen-settings')).toBeVisible()
    await expect(page.getByTestId('tab-settings')).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('phone: Bluesky bottom bar and FAB', () => {
  test('four tabs with Activity, no Profile tab, no centre button, the FAB, no sidebar', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/?demo=1', 'screen-people')
    for (const tab of TABS) {
      await expect(page.getByTestId(`tab-${tab}`)).toBeVisible()
    }
    await expect(page.getByTestId('tab-profile')).toHaveCount(0)
    await expect(page.getByTestId('tab-add')).toHaveCount(0)
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

  test('the FAB shows where Bluesky has one (feeds, profiles, notifications), not on Groups (Lists) or Analytics (Search)', async ({page}) => {
    await page.setViewportSize(PHONE)
    // Empty People has its own Add a friend / Add expense buttons, so no third Add.
    await open(page, '/', 'screen-people')
    await expect(page.getByTestId('people-empty')).toBeVisible()
    await expect(page.getByTestId('screen-people').getByTestId('fab-add')).toHaveCount(0)
    for (const [path, screen] of [['/?demo=1', 'screen-people'], ['/activity', 'screen-activity']]) {
      await open(page, path, screen)
      await expect(page.getByTestId(screen).getByTestId('fab-add')).toBeVisible()
    }
    for (const [path, screen] of [['/groups', 'screen-groups'], ['/analytics', 'screen-analytics']]) {
      await open(page, path, screen)
      await expect(page.getByTestId(screen).getByTestId('fab-add')).toHaveCount(0)
    }
  })

  test('the composer covers the whole phone screen, top bar and tab bar included', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/expense/new', 'screen-add-expense')
    const box = (await page.getByTestId('screen-add-expense').boundingBox())!
    expect(box.y).toBe(0)
    expect(box.height).toBe(PHONE.height)
    expect(box.width).toBe(PHONE.width)
  })

  test('the FAB opens Add expense like the composer; the close cross returns', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/?demo=1', 'screen-people')
    await page.getByTestId('fab-add').click()
    await expect(page).toHaveURL(/\/expense\/new$/)
    await expect(page.getByTestId('screen-add-expense')).toBeVisible()
    await page.getByTestId('sheet-close').click()
    await expect(page).toHaveURL(/\/(\?demo=1)?$/)
    await expect(page.getByTestId('screen-add-expense')).toHaveCount(0)
  })

  test('the avatar is at the top right of the top bar; the logo stays centred', async ({page}) => {
    await page.setViewportSize(PHONE)
    for (const [path, screen] of TOP_LEVEL) {
      await open(page, path, screen)
      const box = (await avatarOn(page, screen).boundingBox())!
      // The avatar sits on the 16px phone gutter (its 4px halo overhangs it).
      expect(PHONE.width - (box.x + box.width)).toBe(16 - 4)
      expect(box.y).toBeLessThan(20)
    }
    await open(page, '/', 'screen-people')
    const logo = (await page.getByTestId('logo').boundingBox())!
    expect(Math.abs(logo.x + logo.width / 2 - PHONE.width / 2)).toBeLessThan(1)
  })

  test('the top bar slides away on scroll down and comes back on scroll up', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/analytics?demo=1', 'screen-analytics')
    await expect(page.getByTestId('analytics-expenses-title')).toBeVisible()
    const avatar = avatarOn(page, 'screen-analytics')
    await expect(avatar).toBeInViewport()
    await page.mouse.wheel(0, 900)
    await expect(avatar).not.toBeInViewport()
    await page.mouse.wheel(0, -300)
    await expect(avatar).toBeInViewport()
  })

  test('tabs navigate; Profile and Settings open from the avatar menu', async ({page}) => {
    await page.setViewportSize(PHONE)
    await open(page, '/', 'screen-people')
    await page.getByTestId('tab-groups').click()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.getByTestId('tab-activity').click()
    await expect(page.getByTestId('screen-activity')).toBeVisible()
    await page.getByTestId('tab-analytics').click()
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await avatarOn(page, 'screen-analytics').click()
    await page.getByTestId('header-menu-profile').click()
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
  await expect(page.getByTestId('tab-activity')).toHaveCount(0)
  const order = await page.getByRole('navigation').locator('[data-testid^="tab-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(order).toEqual(['tab-groups', 'tab-people'])
  // Hiding tabs never strands Settings: the avatar menu still reaches it.
  await expect(avatarOn(page, 'screen-people')).toBeVisible()

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

test('Profile: Edit profile renames me (only my name, no UPI field)', async ({page}) => {
  await open(page, '/profile', 'screen-profile')
  // Until a real name is set, the name's place asks for one.
  await expect(page.getByTestId('profileHeaderDisplayName')).toHaveText('Add your name')
  await page.getByTestId('profile-edit').click()
  await expect(page.getByTestId('friend-upi')).toHaveCount(0)
  await page.getByTestId('friend-name').fill('Saransh Balyan')
  await page.getByTestId('friend-save').click()
  await expect(page.getByTestId('profileHeaderDisplayName')).toHaveText('Saransh Balyan')
  await page.reload()
  await expect(page.getByTestId('profileHeaderDisplayName')).toHaveText('Saransh Balyan')
})

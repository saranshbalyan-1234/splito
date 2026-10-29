import {expect, type Page, test} from '@playwright/test'

const LAPTOP = {width: 1280, height: 800}
const PHONE = {width: 390, height: 844}

const BLUESKY_BLUE = 'rgb(0, 106, 255)'
const EMERALD = 'rgb(11, 130, 99)'

async function open(page: Page, path: string, screen: string) {
  await page.goto(path)
  await expect(page.getByTestId(screen)).toBeVisible()
}

function background(page: Page, testID: string) {
  return page
    .getByTestId(testID)
    .evaluate(el => getComputedStyle(el).backgroundColor)
}

test('the Settings list has a page for every preference group, plus About', async ({
  page,
}) => {
  await open(page, '/settings', 'screen-settings')
  for (const id of [
    'appearance',
    'navigation',
    'defaults',
    'categories',
    'regional',
    'notifications',
    'privacy',
    'about',
  ]) {
    await expect(page.getByTestId(`settings-${id}`)).toBeVisible()
  }
  // Motion and haptics, and Sorting and filters, are gone (F-251): seven preference pages.
  for (const id of ['motion', 'lists']) await expect(page.getByTestId(`settings-${id}`)).toHaveCount(0)
  await page.getByTestId('settings-regional').click()
  await expect(page).toHaveURL(/\/settings\/regional$/)
  await expect(page.getByTestId('pref-language')).toBeVisible()
  await expect(page.getByTestId('pref-timezone')).toBeVisible()
})

test('an accent is only previewed until Apply, then tints the app and survives a reload', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await open(page, '/settings/appearance', 'screen-settings-section')
  expect(await background(page, 'sidebar-add')).toBe(BLUESKY_BLUE)

  // The Accent color sheet: Apply is off until another colour is chosen.
  await page.getByTestId('accent-open').click()
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('accent-emerald').click()
  // Choosing previews the colour inside the sheet only.
  expect(await background(page, 'accent-preview')).toBe(EMERALD)
  expect(await background(page, 'sidebar-add')).toBe(BLUESKY_BLUE)

  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('accent-sheet')).toHaveCount(0)
  await expect.poll(() => background(page, 'sidebar-add')).toBe(EMERALD)

  await page.reload()
  await expect(page.getByTestId('screen-settings-section')).toBeVisible()
  expect(await background(page, 'sidebar-add')).toBe(EMERALD)
  // Owner rule (26.11): the accent recolours the logo too.
  await expect(
    page.getByTestId('logo').locator('path').first(),
  ).toHaveAttribute('fill', /^#0B8263$/i)

  await page.getByTestId('reset-accent').click()
  await expect.poll(() => background(page, 'sidebar-add')).toBe(BLUESKY_BLUE)
})

test('hiding Groups removes it from the phone bar only; the drawer and the sidebar keep it (owner 155)', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await open(page, '/settings/navigation', 'screen-settings-section')
  await expect(page.getByTestId('tab-groups')).toBeVisible()
  await page.getByTestId('tabs-toggle-groups').click()
  // The bottom bar is on screen here too, and follows the saved preference.
  await expect(page.getByTestId('tab-groups')).toHaveCount(0)

  await open(page, '/', 'screen-home')
  await expect(page.getByTestId('tab-home')).toBeVisible()
  await expect(page.getByTestId('tab-groups')).toHaveCount(0)
  // The avatar's drawer still lists every item and reaches Settings.
  await page.getByTestId('screen-home').getByTestId('header-avatar').click()
  await expect(page.getByTestId('drawer-groups')).toBeVisible()
  await page.getByTestId('drawer-settings').click()
  await expect(page.getByTestId('screen-settings')).toBeVisible()

  // Wide screens always list every item: Groups is still on the sidebar, after the items that are on.
  await page.setViewportSize(LAPTOP)
  await open(page, '/', 'screen-home')
  await expect(page.getByTestId('tab-more')).toHaveCount(0)
  await page.getByTestId('tab-groups').click()
  await expect(page.getByTestId('screen-groups')).toBeVisible()
})

/* Owners 127, 155: the one choice drives the phone bar's order; the sidebar (1440) and the rail (860) list every item in it. */
for (const width of [1440, 860]) {
  test(`Settings > Navigation orders the ${width < 1000 ? 'rail' : 'sidebar'} at ${width}px, which always lists every item: off, reorder, Reset`, async ({
    page,
  }) => {
    await page.setViewportSize({width, height: 900})
    await open(page, '/settings/navigation', 'screen-settings-section')
    const order = () =>
      page
        .getByRole('navigation')
        .locator('[data-testid^="tab-"]')
        .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
    // Default: the bottom bar's five, then the rest (Ask Splito and Settings are off); never a More.
    const DEFAULT = ['tab-home', 'tab-people', 'tab-groups', 'tab-analytics', 'tab-activity', 'tab-ask', 'tab-settings']
    await expect.poll(order).toEqual(DEFAULT)
    await expect(page.getByTestId('tab-more')).toHaveCount(0)

    await page.getByTestId('tabs-toggle-groups').click()
    await page.getByTestId('tabs-up-activity').click()
    // Off items follow the ones that are on, in the shared order.
    await expect
      .poll(order)
      .toEqual(['tab-home', 'tab-people', 'tab-activity', 'tab-analytics', 'tab-groups', 'tab-ask', 'tab-settings'])

    // An off item opens like any row and is lit there.
    await page.getByTestId('tab-groups').click()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await expect(page.getByTestId('tab-groups')).toHaveAttribute('aria-current', 'page')

    // Ask Splito keeps its Search & Ask behaviour.
    await page.getByTestId('tab-ask').click()
    await expect(page.getByTestId('ask-chat')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.goto('/settings/navigation')
    await expect(page.getByTestId('screen-settings-section')).toBeVisible()
    await expect
      .poll(order)
      .toEqual(['tab-home', 'tab-people', 'tab-activity', 'tab-analytics', 'tab-groups', 'tab-ask', 'tab-settings'])
    await page.getByTestId('reset-tabs').click()
    await expect.poll(order).toEqual(DEFAULT)

    // With every item on the list is the same.
    for (const tab of ['ask', 'settings'])
      await page.getByTestId(`tabs-toggle-${tab}`).click()
    await expect.poll(order).toEqual(DEFAULT)
  })
}

test('Settings can join the phone bar, with arrows to reorder and Reset', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await open(page, '/settings/navigation', 'screen-settings-section')
  const top = async (tab: string) =>
    (await page.getByTestId(`tabs-toggle-${tab}`).boundingBox())!.y
  expect(await top('home')).toBeLessThan(await top('people'))
  expect(await top('people')).toBeLessThan(await top('groups'))
  await page.getByTestId('tabs-up-analytics').click()
  await expect
    .poll(async () => (await top('analytics')) < (await top('groups')))
    .toBe(true)
  // Home stays first: nothing moves above it, so the row under it can go no higher.
  await page.getByTestId('tabs-up-analytics').click()
  await expect
    .poll(async () => (await top('analytics')) < (await top('people')))
    .toBe(true)
  await expect(page.getByTestId('tabs-up-analytics')).toBeDisabled()

  await page.getByTestId('tabs-toggle-settings').click()
  await page.setViewportSize(PHONE)
  // The bar re-renders for the phone width after the resize: poll, a read right after it can still see the old bar.
  await expect
    .poll(() =>
      page
        .getByRole('navigation')
        .locator('[data-testid^="tab-"]')
        .evaluateAll(els => els.map(e => e.getAttribute('data-testid'))),
    )
    .toEqual([
      'tab-home',
      'tab-analytics',
      'tab-people',
      'tab-groups',
      'tab-activity',
      'tab-settings',
    ])

  await page.setViewportSize(LAPTOP)
  await page.getByTestId('reset-tabs').click()
  await expect(page.getByTestId('tabs-toggle-settings')).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect
    .poll(async () => (await top('groups')) < (await top('analytics')))
    .toBe(true)
})

test('the bar takes any number of tabs, down to Home alone, and Home cannot be hidden', async ({
  page,
}) => {
  await open(page, '/settings/navigation', 'screen-settings-section')
  for (const tab of ['people', 'groups', 'analytics', 'activity']) {
    await page.getByTestId(`tabs-toggle-${tab}`).click()
    await expect(page.getByTestId(`tabs-toggle-${tab}`)).toHaveAttribute(
      'aria-checked',
      'false',
    )
  }
  // Nothing is locked but Home, even with Home alone left.
  await expect(page.getByTestId('tabs-toggle-home')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(page.getByTestId('tabs-toggle-activity')).not.toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(page.getByTestId('tabs-count-note')).toContainText('Only Home')
  // Every item can go on, past five: seven tabs.
  for (const tab of ['people', 'groups', 'analytics', 'ask', 'activity', 'settings']) {
    const toggle = page.getByTestId(`tabs-toggle-${tab}`)
    if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  }
  await expect(page.getByTestId('tabs-count-note')).toContainText('7 tabs')
})

test('choosing Hindi switches the whole UI live and persists', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await open(page, '/settings/regional', 'screen-settings-section')
  await page.getByTestId('language-hi').click()
  await expect(page.getByText('भाषा और क्षेत्र').first()).toBeVisible()
  await expect(page.getByTestId('tab-home')).toContainText('घर')
  await expect(page.getByTestId('pref-timezone')).toContainText('समय क्षेत्र')

  await page.reload()
  await expect(page.getByTestId('tab-home')).toContainText('घर')
  await page.getByTestId('language-en').click()
  await expect(page.getByTestId('tab-home')).toContainText('Home')
})

test('Reset restores one default, and Reset all restores every default', async ({
  page,
}) => {
  await open(page, '/settings/appearance', 'screen-settings-section')
  await expect(page.getByTestId('reset-moneyPalette')).toHaveCount(0)
  await page.getByTestId('moneyPalette-mono').click()
  await expect(page.getByTestId('moneyPalette-mono')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByTestId('reset-moneyPalette').click()
  await expect(page.getByTestId('moneyPalette-default')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('reset-moneyPalette')).toHaveCount(0)

  await page.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveClass(/theme--dim/)
  await page.getByTestId('textScale-1.125').click()
  await expect(page.getByTestId('textScale-1.125')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await open(page, '/settings', 'screen-settings')
  await page.getByTestId('settings-reset-all').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.locator('html')).toHaveClass(/theme--light/)

  await open(page, '/settings/appearance', 'screen-settings-section')
  await expect(page.getByTestId('theme-system')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('textScale-1')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('reset-theme')).toHaveCount(0)
})

test('categories: rename one, add one, then hide it', async ({page}) => {
  await open(page, '/settings/categories', 'screen-settings-section')
  await page.getByTestId('category-edit-food').click()
  await expect(page.getByTestId('category-name')).toHaveValue('Food')
  await page.getByTestId('category-name').fill('Eating out')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('category-food')).toContainText('Eating out')

  await page.getByTestId('category-add').click()
  await expect(page.getByTestId('category-name')).toHaveValue('')
  await page.getByTestId('category-name').fill('Rent')
  await page.getByTestId('category-icon-house').click()
  await page.getByTestId('sheet-save').click()
  const row = page
    .locator('[data-testid^="category-"]')
    .filter({hasText: 'Rent'})
    .first()
  await expect(row).toBeVisible()
  await row.getByRole('button', {name: 'Hide Rent'}).click()
  await expect(row).toContainText('Hidden')
})

test('every on/off setting is a switch, on web too, with its label and checked state (owner 132)', async ({
  page,
}) => {
  await open(page, '/settings/notifications', 'screen-settings-section')
  for (const key of ['notify.payment', 'notify.comments', 'notify.invite', 'notify.reminders']) {
    const sw = page.getByTestId(`${key}-switch`)
    await expect(sw).toHaveAttribute('role', 'switch')
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect(sw).toHaveAttribute('aria-label', /.+/)
  }
  await page.getByTestId('notify.comments-switch').click()
  await expect(page.getByTestId('notify.comments-switch')).toHaveAttribute('aria-checked', 'false')
  await open(page, '/settings', 'screen-settings')
  await expect(page.getByTestId('settings-demo-mode')).toHaveAttribute('role', 'switch')
})

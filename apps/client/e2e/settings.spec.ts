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
    'motion',
    'navigation',
    'defaults',
    'categories',
    'regional',
    'lists',
    'notifications',
    'about',
  ]) {
    await expect(page.getByTestId(`settings-${id}`)).toBeVisible()
  }
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

test('hiding Groups removes it from the phone bar only; the sidebar and drawer keep it', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await open(page, '/settings/navigation', 'screen-settings-section')
  await expect(page.getByTestId('tab-groups')).toBeVisible()
  await page.getByTestId('tabs-toggle-groups').click()
  // The bottom bar is on screen here too, and follows the saved preference.
  await expect(page.getByTestId('tab-groups')).toHaveCount(0)

  await open(page, '/', 'screen-people')
  await expect(page.getByTestId('tab-people')).toBeVisible()
  await expect(page.getByTestId('tab-groups')).toHaveCount(0)
  // The avatar's drawer still lists every item and reaches Settings.
  await page.getByTestId('screen-people').getByTestId('header-avatar').click()
  await expect(page.getByTestId('drawer-groups')).toBeVisible()
  await page.getByTestId('drawer-settings').click()
  await expect(page.getByTestId('screen-settings')).toBeVisible()

  await page.setViewportSize(LAPTOP)
  await open(page, '/', 'screen-people')
  await expect(page.getByTestId('tab-groups')).toBeVisible()
  await expect(page.getByTestId('tab-settings')).toBeVisible()
  await open(page, '/groups', 'screen-groups')
})

test('Settings can join the phone bar (5 at most), with arrows to reorder and Reset', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await open(page, '/settings/navigation', 'screen-settings-section')
  const top = async (tab: string) =>
    (await page.getByTestId(`tabs-toggle-${tab}`).boundingBox())!.y
  expect(await top('people')).toBeLessThan(await top('groups'))
  await page.getByTestId('tabs-up-analytics').click()
  await expect
    .poll(async () => (await top('analytics')) < (await top('groups')))
    .toBe(true)
  // Home stays first: nothing moves above it.
  await expect(page.getByTestId('tabs-up-analytics')).toBeDisabled()

  await page.getByTestId('tabs-toggle-settings').click()
  await expect(page.getByTestId('tabs-limit-note')).toContainText('up to 5')
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
      'tab-people',
      'tab-analytics',
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

test('the bar keeps at least two tabs and Home cannot be hidden', async ({
  page,
}) => {
  await open(page, '/settings/navigation', 'screen-settings-section')
  for (const tab of ['groups', 'analytics']) {
    await page.getByTestId(`tabs-toggle-${tab}`).click()
    await expect(page.getByTestId(`tabs-toggle-${tab}`)).toHaveAttribute(
      'aria-checked',
      'false',
    )
  }
  await expect(page.getByTestId('tabs-toggle-activity')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(page.getByTestId('tabs-toggle-people')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(page.getByTestId('tabs-limit-note')).toContainText('at least 2')
})

test('choosing Hindi switches the whole UI live and persists', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await open(page, '/settings/regional', 'screen-settings-section')
  await page.getByTestId('language-hi').click()
  await expect(page.getByText('भाषा और क्षेत्र').first()).toBeVisible()
  await expect(page.getByTestId('tab-people')).toContainText('घर')
  await expect(page.getByTestId('pref-timezone')).toContainText('समय क्षेत्र')

  await page.reload()
  await expect(page.getByTestId('tab-people')).toContainText('घर')
  await page.getByTestId('language-en').click()
  await expect(page.getByTestId('tab-people')).toContainText('Home')
})

test('Reset restores one default, and Reset all restores every default', async ({
  page,
}) => {
  await open(page, '/settings/appearance', 'screen-settings-section')
  await expect(page.getByTestId('reset-density')).toHaveCount(0)
  await page.getByTestId('density-compact').click()
  await expect(page.getByTestId('density-compact')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByTestId('reset-density').click()
  await expect(page.getByTestId('density-comfortable')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('reset-density')).toHaveCount(0)

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

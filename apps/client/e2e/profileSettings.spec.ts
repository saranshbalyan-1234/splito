import {expect, type Page, test} from '@playwright/test'


/*
 * Owners 201-206, 217, 220 (ARCHITECTURE 26.3, 26.4, 26.7, 26.15): the avatar opens Profile at every width and Back
 * returns where you were; Settings is no tab or nav item, it is the list inside Profile (`/settings` opens Profile);
 * Log out is the last row of Profile; Support and Your data are one row each in that list and open their own pages,
 * whose Back returns to Profile; a phone has no side drawer (owner 217).
 */

const VIEWPORTS = [
  ['phone 390', {width: 390, height: 844}],
  ['desktop 1440', {width: 1440, height: 900}],
] as const

const here = (page: Page) => new URL(page.url()).pathname

for (const [label, viewport] of VIEWPORTS) {
  test.describe(label, () => {
    test.use({viewport})

    test('the avatar opens Profile and Back returns to the tab it was on (owner 201)', async ({page}) => {
      for (const [path, screen] of [
        ['/activity', 'screen-activity'],
        ['/analytics', 'screen-analytics'],
        ['/groups', 'screen-groups'],
      ] as const) {
        await page.goto(path)
        await expect(page.getByTestId(screen)).toBeVisible()
        await page.getByTestId(screen).getByTestId('header-avatar').click()
        await expect(page).toHaveURL(/\/profile$/)
        await expect(page.getByTestId('screen-profile')).toBeVisible()
        await page.getByTestId('screen-profile').getByTestId('header-back').click()
        await expect(page.getByTestId(screen)).toBeVisible()
        expect(here(page)).toBe(path)
      }
    })

    test('a cold /profile goes back to the start tab (owner 206)', async ({page}) => {
      await page.goto('/profile')
      await page.getByTestId('screen-profile').getByTestId('header-back').click()
      await expect(page.getByTestId('screen-people')).toBeVisible()
    })

    test('Settings is no item of the bar, the sidebar or Settings > Navigation (owner 220)', async ({page}) => {
      await page.goto('/activity')
      await expect(page.getByTestId('screen-activity')).toBeVisible()
      // The bar on a phone and the sidebar on a laptop are both the page's navigation landmark.
      const items = () =>
        page
          .getByRole('navigation')
          .locator('[data-testid^="tab-"]:not([data-testid="tab-label"])')
          .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
      await expect.poll(items).toEqual(['tab-people', 'tab-groups', 'tab-analytics', 'tab-activity'])
      await expect(page.getByTestId('tab-settings')).toHaveCount(0)
      // The editor lists the same four.
      await page.goto('/settings/navigation')
      await expect(page.getByTestId('screen-settings-section')).toBeVisible()
      await expect(page.getByTestId('tabs-toggle-people')).toBeVisible()
      await expect(page.getByTestId('tabs-toggle-settings')).toHaveCount(0)
      await expect(page.getByTestId('tabs-up-settings')).toHaveCount(0)
    })

    test('/settings opens Profile: the person first, then the Settings rows, then Log out (owner 220)', async ({page}) => {
      await page.goto('/settings')
      await expect(page.getByTestId('screen-profile')).toBeVisible()
      await expect(page).toHaveURL(/\/profile$/)
      // There is no screen of Settings's own any more.
      await expect(page.getByTestId('screen-settings')).toHaveCount(0)
      const list = page.getByTestId('profile-settings')
      await expect(list).toBeVisible()
      for (const id of ['settings-friends', 'settings-appearance', 'settings-navigation', 'settings-support', 'settings-data'])
        await expect(list.getByTestId(id)).toBeVisible()
      // No Profile or Log out row inside the list, and no Support or Data items spread out (owners 202, 204, 205, 216).
      for (const id of ['settings-profile', 'settings-log-out', 'settings-send-feedback', 'settings-help', 'settings-about', 'settings-export', 'settings-import', 'settings-reset-all'])
        await expect(page.getByTestId(id)).toHaveCount(0)
      // Top to bottom: the person (header), the Settings list, Log out (document order, wherever the page is scrolled to).
      const inOrder = await page.evaluate(ids => {
        const els = ids.map(id => document.querySelector(`[data-testid="${id}"]`))
        return els.every((el, i) => el !== null && (i === 0 || !!(els[i - 1]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)))
      }, ['profile-avatar', 'settings-friends', 'profile-log-out'])
      expect(inOrder).toBe(true)
    })

    test('a Settings section opens from Profile and Back returns to Profile (owner 220)', async ({page}) => {
      await page.goto('/activity')
      await page.getByTestId('screen-activity').getByTestId('header-avatar').click()
      await expect(page.getByTestId('screen-profile')).toBeVisible()
      await page.getByTestId('settings-regional').click()
      await expect(page).toHaveURL(/\/settings\/regional$/)
      await page.getByTestId('screen-settings-section').last().getByTestId('header-back').click()
      await expect(page).toHaveURL(/\/profile$/)
      await expect(page.getByTestId('screen-profile')).toBeVisible()
      // And on to where Profile was opened from.
      await page.getByTestId('screen-profile').getByTestId('header-back').click()
      await expect(page.getByTestId('screen-activity')).toBeVisible()
      // A section pasted cold climbs to Profile, then to the start tab.
      await page.goto('/settings/regional')
      await page.getByTestId('screen-settings-section').last().getByTestId('header-back').click()
      await expect(page).toHaveURL(/\/profile$/)
      await page.getByTestId('screen-profile').getByTestId('header-back').click()
      await expect(page.getByTestId('screen-people')).toBeVisible()
    })

    test('Profile ends in Log out, which asks first (owners 202, 220)', async ({page}) => {
      await page.goto('/activity')
      await page.getByTestId('screen-activity').getByTestId('header-avatar').click()
      await expect(page.getByTestId('screen-profile')).toBeVisible()
      const ids = await page
        .getByTestId('screen-profile')
        .locator('[data-testid^="profile-"]')
        .evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
      expect(ids.at(-1)).toBe('profile-log-out')
      await page.getByTestId('profile-log-out').click()
      const prompt = page.getByRole('dialog').filter({hasText: 'Log out?'})
      await expect(prompt).toContainText('This removes all your Splito data from this device')
      // Not confirmed here (auth.spec erases): Escape leaves everything as it was.
      await page.keyboard.press('Escape')
      await expect(prompt).toHaveCount(0)
      await expect(page.getByTestId('screen-profile')).toBeVisible()
    })

    test('Settings > Support: every row opens, Back returns to Support, then to Profile (owners 204, 220)', async ({page}) => {
      await page.goto('/profile')
      await page.getByTestId('settings-support').click()
      await expect(page).toHaveURL(/\/settings\/support$/)
      await expect(page.getByTestId('support-version')).toContainText('Splito version')
      const back = () => page.getByTestId('screen-settings-section').last().getByTestId('header-back').click()
      for (const [row, url] of [
        ['settings-your-feedback', /\/settings\/feedback$/],
        ['settings-help', /\/settings\/help$/],
        ['settings-support-privacy', /\/settings\/privacy$/],
        ['settings-about', /\/settings\/about$/],
      ] as const) {
        await page.getByTestId(row).click()
        await expect(page).toHaveURL(url)
        await back()
        await expect(page).toHaveURL(/\/settings\/support$/)
      }
      await page.getByTestId('settings-send-feedback').click()
      await expect(page.getByTestId('feedback-sheet')).toBeVisible()
      await page.getByTestId('sheet-cancel').click()
      await expect(page.getByTestId('feedback-sheet')).toHaveCount(0)
      await back()
      await expect(page).toHaveURL(/\/profile$/)
      await expect(page.getByTestId('screen-profile')).toBeVisible()
    })

    test('a refreshed help page climbs to Support, then Profile', async ({page}) => {
      await page.goto('/settings/about')
      const back = () => page.getByTestId('screen-settings-section').last().getByTestId('header-back').click()
      await back()
      await expect(page).toHaveURL(/\/settings\/support$/)
      await back()
      await expect(page).toHaveURL(/\/profile$/)
    })

    test('Settings > Your data: Export opens, Back returns to Your data, then to Profile (owners 205, 220)', async ({page}) => {
      await page.goto('/profile')
      await page.getByTestId('settings-data').click()
      await expect(page).toHaveURL(/\/settings\/data$/)
      for (const id of ['settings-export', 'settings-import', 'settings-reset-all']) await expect(page.getByTestId(id)).toBeVisible()
      await page.getByTestId('settings-export').click()
      await expect(page.getByTestId('export-sheet')).toBeVisible()
      await expect(page).toHaveURL(/\/settings\/data\/export$/)
      await page.goBack()
      await expect(page.getByTestId('export-sheet')).toHaveCount(0)
      await expect(page).toHaveURL(/\/settings\/data$/)
      await page.getByTestId('screen-settings-section').last().getByTestId('header-back').click()
      await expect(page).toHaveURL(/\/profile$/)
    })

    test('old Export and Recently deleted addresses land on Your data', async ({page}) => {
      await page.goto('/settings/export')
      await expect(page).toHaveURL(/\/settings\/data\/export$/)
      await expect(page.getByTestId('export-sheet')).toBeVisible()
      await page.goto('/settings/recently-deleted')
      await expect(page).toHaveURL(/\/settings\/data\?note=deleted-stay$/)
      await expect(page.getByTestId('settings-deleted-note')).toBeVisible()
    })
  })
}

test.describe('phone 390: there is no side drawer, the bottom bar is the navigation (owner 217)', () => {
  test.use({viewport: {width: 390, height: 844}})

  test('no swipe (Safari\'s Back from the edge, the middle, vertical) and no old ?drawer=menu address opens one', async ({page}) => {
    await page.goto('/activity')
    await expect(page.getByTestId('screen-activity')).toBeVisible()
    const swipe = (from: {x: number; y: number}, to: {x: number; y: number}) =>
      page.evaluate(
        ([a, b]) => {
          const fire = (type: string, x: number, y: number) => {
            const touch = new Touch({identifier: 1, target: document.body, clientX: x, clientY: y})
            document.dispatchEvent(new TouchEvent(type, {touches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true}))
          }
          fire('touchstart', a!.x, a!.y)
          fire('touchmove', (a!.x + b!.x) / 2, (a!.y + b!.y) / 2)
          fire('touchmove', b!.x, b!.y)
          fire('touchend', b!.x, b!.y)
        },
        [from, to],
      )
    await swipe({x: 4, y: 400}, {x: 120, y: 404})
    await swipe({x: 200, y: 400}, {x: 320, y: 402})
    await swipe({x: 4, y: 300}, {x: 30, y: 700})
    await page.waitForTimeout(300)
    await expect(page.getByTestId('drawer')).toHaveCount(0)
    // An old link to the drawer opens its page alone.
    await page.goto('/groups?drawer=menu')
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.waitForTimeout(300)
    await expect(page.getByTestId('drawer')).toHaveCount(0)
    await expect(page.getByRole('navigation').getByTestId('tab-activity')).toBeVisible()
  })

  test('the avatar no longer opens the drawer', async ({page}) => {
    await page.goto('/activity')
    await page.getByTestId('screen-activity').getByTestId('header-avatar').click()
    await expect(page.getByTestId('drawer')).toHaveCount(0)
    await expect(page.getByTestId('screen-profile')).toBeVisible()
  })
})

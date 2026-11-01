import {mkdirSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-278 owners 209, 228 (ARCHITECTURE 26.15): Profile fits one phone screen, top to bottom: a compact header row,
 * the stat row, the Settings rows with Payment details first, Log out, the sync note under it. Run on the demo data
 * at 390 and 1440.
 * PROFILE_SHOTS=<dir> also saves the page in light and Dim there.
 */

const VIEWPORTS = [
  ['phone 390', {width: 390, height: 844}],
  ['desktop 1440', {width: 1440, height: 900}],
] as const

/** The address without `from=<tab>`, which a link-opened main screen adds so a refresh keeps its Back (owner 184). */
const here = (page: Page) => {
  const url = new URL(page.url())
  url.searchParams.delete('from')
  return url.pathname + url.search
}

for (const [label, viewport] of VIEWPORTS) {
  test.describe(label, () => {
    test.use({viewport})

    test.beforeEach(async ({page}) => {
      await openDemo(page, '/profile')
      await expect(page.getByTestId('screen-profile')).toBeVisible()
    })

    test('the header holds the avatar, name, verified email and phone, the since date and Edit profile', async ({page}) => {
      const profile = page.getByTestId('screen-profile')
      await expect(profile.getByTestId('profile-avatar')).toBeVisible()
      await expect(profile.getByTestId('profileHeaderDisplayName')).toBeVisible()
      await expect(profile.getByTestId('profile-email')).toContainText('dev@splito.test')
      await expect(profile.getByTestId('profile-phone')).toContainText('+919876500001')
      await expect(profile.getByTestId('profile-email-verified')).toBeVisible()
      await expect(profile.getByTestId('profile-phone-verified')).toBeVisible()
      await expect(profile.getByTestId('profile-since')).toContainText(String(new Date().getFullYear()))
      // The avatar and the Edit button open the same sheet.
      await profile.getByTestId('profile-avatar').click()
      await expect(page.getByTestId('edit-friend-sheet')).toBeVisible()
      await expect(page).toHaveURL(/\/profile\/edit$/)
    })

    test('the sections come in order: stats, Settings rows (Payment details first), Log out, the sync note (owners 202, 225, 228)', async ({page}) => {
      const profile = page.getByTestId('screen-profile')
      await expect(profile.getByTestId('profile-log-out')).toBeVisible()
      await expect(profile.getByTestId('profile-cards')).toHaveCount(0)
      await expect(profile.getByTestId('profile-recent')).toHaveCount(0)
      // Add me is gone (owner 228): Friends and invites holds the friend link and QR.
      await expect(profile.getByTestId('profile-add-me')).toHaveCount(0)
      const ids = await profile
        .locator('[data-testid^="profile-"]')
        .evaluateAll(els => els.map(e => e.getAttribute('data-testid')!))
      // The rows' container comes first in the document, then Payment details (its first row) and Friends and invites.
      const order = ['profile-stats', 'profile-settings', 'profile-payment', 'profile-log-out', 'profile-sync-note']
      const at = order.map(id => ids.indexOf(id))
      expect(at.every(i => i >= 0), ids.join()).toBe(true)
      expect(at).toEqual([...at].sort((x, y) => x - y))
      // Payment details is the first row of the list, no "Settings" heading above it.
      const list = profile.getByTestId('profile-settings')
      await expect(list.getByText('Settings', {exact: true})).toHaveCount(0)
      const payment = await profile.getByTestId('profile-payment').boundingBox()
      const friends = await list.getByTestId('settings-friends').boundingBox()
      expect(payment!.y).toBeLessThan(friends!.y)
    })

    test('each stat opens its page: People, Groups, Activity (Me, transactions) and Analytics', async ({page}) => {
      const stat = (key: string) => page.getByTestId('screen-profile').getByTestId(`profile-stat-${key}`)
      for (const key of ['friends', 'groups', 'expenses', 'paid']) await expect(stat(key)).toContainText(/\d/)
      const cases = [
        ['friends', /^\/people$/, 'screen-people'],
        ['groups', /^\/groups$/, 'screen-groups'],
        ['expenses', /^\/activity\/me\?type=transactions$/, 'screen-activity'],
        ['paid', /^\/analytics\?(currency=[A-Z]{3}&)?period=year$/, 'screen-analytics'],
      ] as const
      for (const [key, url, screen] of cases) {
        await stat(key).click()
        await expect(page.getByTestId(screen)).toBeVisible()
        expect(here(page)).toMatch(url)
        await page.goBack()
        await expect(page.getByTestId('screen-profile')).toBeVisible()
      }
    })

    test('Payment details: the UPI ID is added in the edit sheet and then shown', async ({page}) => {
      const payment = page.getByTestId('profile-payment')
      await expect(payment.getByTestId('profile-upi')).not.toHaveText('me@bank')
      await payment.getByTestId('profile-upi-edit').click()
      await expect(page).toHaveURL(/\/profile\/payment$/)
      await page.getByTestId('friend-upi').fill('me@bank')
      await page.getByRole('button', {name: 'Save'}).click()
      await expect(payment.getByTestId('profile-upi')).toHaveText('me@bank')
    })

    test('Friends and invites holds my friend link and QR, which Profile no longer repeats (owner 228)', async ({page}) => {
      await expect(page.getByTestId('screen-profile').getByTestId('profile-add-me')).toHaveCount(0)
      await page.goto('/settings/friends?section=links')
      const screen = page.getByTestId('screen-friends-invites')
      await expect(screen).toBeVisible()
      await expect(screen.getByTestId('hub-create-link')).toBeVisible()
    })

    test('the header row is compact: a 64 px avatar, the name and contacts to its right, Edit as an icon (owner 228)', async ({page}) => {
      const profile = page.getByTestId('screen-profile')
      const avatar = await profile.getByTestId('profile-avatar').boundingBox()
      const edit = await profile.getByTestId('profile-edit').boundingBox()
      const since = await profile.getByTestId('profile-since').boundingBox()
      const name = await profile.getByTestId('profileHeaderDisplayName').boundingBox()
      expect(avatar!.width).toBeLessThanOrEqual(72)
      expect(name!.x).toBeGreaterThan(avatar!.x + avatar!.width - 1)
      expect(edit!.x).toBeGreaterThan(name!.x)
      expect(since!.y + since!.height - Math.min(avatar!.y, name!.y)).toBeLessThan(120)
      await expect(profile.getByTestId('profile-edit')).toHaveAttribute('aria-label', /Add your name|Edit profile/)
    })

    test('the body loads after the header and Log out still asks first', async ({page}) => {
      await page.getByTestId('profile-log-out').click()
      const prompt = page.getByRole('dialog').filter({hasText: 'Log out?'})
      await expect(prompt).toContainText('This removes all your Splito data from this device')
      await page.keyboard.press('Escape')
      await expect(prompt).toHaveCount(0)
    })

    test('screenshots in light and Dim', async ({page}) => {
      const dir = process.env.PROFILE_SHOTS
      test.skip(!dir, 'set PROFILE_SHOTS=<dir> to save screenshots')
      mkdirSync(dir!, {recursive: true})
      const set = (theme: string, dark?: string) =>
        page.evaluate(
          async ([th, dk]) => {
            const s = (window as unknown as {splito: {setPref(k: string, v: unknown): Promise<void>}}).splito
            await s.setPref('theme', th)
            if (dk) await s.setPref('darkTheme', dk)
          },
          [theme, dark ?? ''] as const,
        )
      for (const [name, theme, dark] of [['light', 'light', ''], ['dim', 'dark', 'dim']] as const) {
        await set(theme, dark)
        await page.reload()
        await expect(page.getByTestId('profile-log-out')).toBeVisible()
        await page.waitForTimeout(600)
        await page.screenshot({path: join(dir!, `nohome-profile-${viewport.width}-${name}.png`), fullPage: false})
        // The whole page, scrolled through in one tall frame.
        await page.setViewportSize({width: viewport.width, height: 2400})
        await page.waitForTimeout(400)
        await page.screenshot({path: join(dir!, `nohome-profile-${viewport.width}-${name}-full.png`)})
        await page.setViewportSize(viewport)
      }
    })
  })
}

test.describe('fits one phone screen (owner 228)', () => {
  test.use({viewport: {width: 390, height: 844}})

  test('the header, stats, Payment details and Friends and invites show without scrolling', async ({page}) => {
    await openDemo(page, '/profile')
    const profile = page.getByTestId('screen-profile')
    await expect(profile.getByTestId('profile-log-out')).toBeVisible()
    for (const id of ['profile-avatar', 'profile-stats', 'profile-payment', 'settings-friends']) {
      const box = await profile.getByTestId(id).boundingBox()
      expect(box, id).not.toBeNull()
      expect(box!.y + box!.height, `${id} bottom`).toBeLessThan(844)
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('Hindi at 320 px', () => {
  test.use({viewport: {width: 320, height: 700}})

  test('the header row ellipsizes and the page has no horizontal overflow', async ({page}) => {
    await openDemo(page, '/profile')
    await page.evaluate(() => (window as unknown as {splito: {setPref(k: string, v: unknown): Promise<void>}}).splito.setPref('language', 'hi'))
    const profile = page.getByTestId('screen-profile')
    await expect(profile.getByTestId('profile-log-out')).toBeVisible()
    await expect(profile.getByTestId('profile-stats')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const edit = await profile.getByTestId('profile-edit').boundingBox()
    expect(edit!.x + edit!.width).toBeLessThanOrEqual(320)
  })
})

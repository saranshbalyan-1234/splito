import {mkdirSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-271 owner 209 (ARCHITECTURE 26.15): Profile is a full page about you, top to bottom: header, stat row, Your
 * balance, Payment details, Add me, Your recent activity, Log out last. Run on the demo data at 390 and 1440.
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

    test('the sections come in order and Log out is last (owners 202, 209)', async ({page}) => {
      const profile = page.getByTestId('screen-profile')
      await expect(profile.getByTestId('profile-log-out')).toBeVisible()
      await expect(profile.getByTestId('profile-recent')).toBeVisible()
      const ids = await profile
        .locator('[data-testid^="profile-"]')
        .evaluateAll(els => els.map(e => e.getAttribute('data-testid')!))
      const order = ['profile-stats', 'profile-cards', 'profile-payment', 'profile-recent', 'profile-sync-note', 'profile-log-out']
      const at = order.map(id => ids.indexOf(id))
      expect(at.every(i => i >= 0), ids.join()).toBe(true)
      expect(at).toEqual([...at].sort((x, y) => x - y))
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

    test('Your balance shows a card per currency and opens Analytics in it', async ({page}) => {
      const balance = page.getByTestId('profile-cards')
      await expect(balance).toBeVisible()
      const card = balance.locator('[data-testid^="summary-"][data-testid$="-card"]').first()
      const currency = (await card.getAttribute('data-testid'))!.split('-')[1]!
      await balance.getByTestId(`summary-${currency}`).click()
      await expect(page.getByTestId('screen-analytics')).toBeVisible()
      expect(here(page)).toContain(`currency=${currency}`)
      await page.goBack()
      await balance.getByTestId('profile-cards-analytics').click()
      await expect(page.getByTestId('screen-analytics')).toBeVisible()
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

    test('Add me offers my friend QR code and link, or a button to make them', async ({page}) => {
      const addMe = page.getByTestId('profile-add-me')
      await expect(addMe).toBeVisible()
      await expect(addMe.getByTestId('invite-qr').or(addMe.getByTestId('profile-add-me-create'))).toBeVisible()
      if (await addMe.getByTestId('profile-add-me-create').isVisible()) {
        await addMe.getByTestId('profile-add-me-create').click()
        await expect(page.getByTestId('screen-create-invite')).toBeVisible()
      } else {
        await expect(addMe.getByTestId('invite-share')).toBeVisible()
        await expect(addMe.getByTestId('invite-url')).toContainText('/invite/')
      }
    })

    test('Your recent activity shows my last changes, then See all opens Activity on Me', async ({page}) => {
      const recent = page.getByTestId('profile-recent')
      await expect(recent).toBeVisible()
      await recent.getByTestId('profile-recent-all').click()
      await expect(page.getByTestId('screen-activity')).toBeVisible()
      expect(here(page)).toMatch(/^\/activity\/me/)
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

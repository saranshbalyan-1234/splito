import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-253: the guided tour after the first sign-in. E2E builds never start it by themselves; a spec arms it with
 * `window.__splitoTest.tourAuto` before the page loads (the same object the other test hooks live on).
 */
const VIEWPORTS = [
  {name: '390', width: 390, height: 844},
  {name: '1440', width: 1440, height: 900},
] as const

type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
}

async function armTour(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {__splitoTest?: Record<string, unknown>}
    w.__splitoTest = {...w.__splitoTest, tourAuto: true}
  })
}

/** A friend who owes me 100, written through the app's own mutations (dev and e2e builds). */
async function seedFriend(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window, undefined, {timeout: 30_000})
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const kavya = await s.createPerson('Kavya Rao')
    await s.createExpense({
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      title: 'Concert',
      groupId: null,
      total: '20000',
      payers: {[s.me]: '20000'},
      split: {mode: 'equal', participants: [s.me, kavya]},
      date: '2026-10-20',
    })
  })
}

/** The first screen: the app opens on People. */
async function appShown(page: Page) {
  await expect(page.getByTestId('screen-people')).toBeVisible({timeout: 30_000})
}

async function expectInsideViewport(page: Page, testID: string) {
  const box = await page.getByTestId(testID).boundingBox()
  const size = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(size.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(size.height)
}

for (const vp of VIEWPORTS) {
  test.describe(`tour at ${vp.name}`, () => {
    test.beforeEach(async ({page}) => {
      await page.setViewportSize({width: vp.width, height: vp.height})
    })

    test('a new account is toured once: three steps, Done ends it, and it does not come back', async ({page}) => {
      await armTour(page)
      await page.goto('/')
      const tour = page.getByTestId('tour')
      await expect(tour).toBeVisible({timeout: 15_000})
      /* No friends yet: step 1 is the FAB (phone) or the sidebar pill, step 2 stands on Add friend and says so, step 3 is the Groups tab. */
      await expect(page.getByTestId('tour-step')).toHaveText('Step 1 of 3')
      await expect(page.getByTestId('tour-title')).toHaveText('Add an expense')
      await expect(page.getByTestId('tour-body')).toContainText('Start here')
      await expectInsideViewport(page, 'tour-card')
      await page.screenshot({path: `qa/tour/${vp.name}-1-new-account.png`})

      await page.getByTestId('tour-next').click()
      await expect(page.getByTestId('tour-step')).toHaveText('Step 2 of 3')
      await expect(page.getByTestId('tour-title')).toHaveText('See who owes whom')
      await expect(page.getByTestId('tour-body')).toContainText('Your friends will show up here')

      await page.getByTestId('tour-next').click()
      await expect(page.getByTestId('tour-step')).toHaveText('Step 3 of 3')
      await expect(page.getByTestId('tour-title')).toHaveText('Settle up')
      await expect(page.getByTestId('tour-skip')).toHaveCount(0)
      await expect(page.getByTestId('tour-next')).toHaveText('Done')
      await expectInsideViewport(page, 'tour-card')
      await page.screenshot({path: `qa/tour/${vp.name}-3-groups-tab.png`})

      await page.getByTestId('tour-next').click()
      await expect(tour).toHaveCount(0)

      /* Seen: a reload (the preference is read once at launch) shows People and no tour. */
      await page.reload()
      await appShown(page)
      await page.waitForTimeout(1500)
      await expect(page.getByTestId('tour')).toHaveCount(0)
    })

    test('Skip ends it for good', async ({page}) => {
      await armTour(page)
      await page.goto('/')
      await expect(page.getByTestId('tour')).toBeVisible({timeout: 15_000})
      await page.getByTestId('tour-skip').click()
      await expect(page.getByTestId('tour')).toHaveCount(0)
      await page.reload()
      await appShown(page)
      await page.waitForTimeout(1500)
      await expect(page.getByTestId('tour')).toHaveCount(0)
    })

    test('with a friend the steps point at the real controls', async ({page}) => {
      await seedFriend(page)
      await armTour(page)
      await page.reload()
      await expect(page.getByTestId('tour')).toBeVisible({timeout: 15_000})
      await expect(page.getByTestId('tour-step')).toHaveText('Step 1 of 3')
      await expect(page.getByTestId('tour-title')).toHaveText('Add an expense')
      await expect(page.getByTestId('tour-body')).toContainText('Start here')
      /* The caption sits beside the FAB (phone) or the sidebar pill (desktop), inside the screen, with 44 px buttons. */
      await expectInsideViewport(page, 'tour-card')
      const next = await page.getByTestId('tour-next').boundingBox()
      expect(next!.height).toBeGreaterThanOrEqual(44)
      /* The blur sits behind a rounded cut-out on the web, so the control stays sharp. */
      await expect(page.getByTestId('tour-blur')).toHaveCount(1)
      await page.screenshot({path: `qa/tour/${vp.name}-1-with-friend.png`})

      await page.getByTestId('tour-next').click()
      await expect(page.getByTestId('tour-title')).toHaveText('See who owes whom')
      await expect(page.getByTestId('tour-body')).toContainText('Each friend shows')
      await expectInsideViewport(page, 'tour-card')
      await page.screenshot({path: `qa/tour/${vp.name}-2-friend-row.png`})

      await page.getByTestId('tour-next').click()
      await expect(page.getByTestId('tour-title')).toHaveText('Settle up')
      await expect(page.getByTestId('tour-body')).toContainText('Open a friend')
      await expectInsideViewport(page, 'tour-card')
      await page.screenshot({path: `qa/tour/${vp.name}-3-balance.png`})
      await page.getByTestId('tour-next').click()
      await expect(page.getByTestId('tour')).toHaveCount(0)
    })

    test('Escape skips, and the tour blocks the app underneath', async ({page}) => {
      await armTour(page)
      await page.goto('/')
      await expect(page.getByTestId('tour')).toBeVisible({timeout: 15_000})
      /* Focus moved to the caption. */
      await expect(page.getByTestId('tour-card')).toBeFocused()
      /* A tap on the real control under the dim does nothing (no Add friend sheet opens). */
      const addFriend = page.getByTestId('people-add-friend')
      const box = (await addFriend.boundingBox())!
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await expect(page.getByTestId('tour')).toBeVisible()
      await expect(page).not.toHaveURL(/add-friend|AddFriend/i)
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('tour')).toHaveCount(0)
    })

    test('Settings > Support "Take the tour" replays it on People', async ({page}) => {
      await page.goto('/settings/support')
      await expect(page.getByTestId('screen-settings-section')).toBeVisible()
      await page.getByTestId('settings-take-tour').click()
      await expect(page.getByTestId('tour')).toBeVisible({timeout: 15_000})
      await expect(page.getByTestId('screen-people')).toBeVisible()
      await expect(page.getByTestId('tour-step')).toHaveText('Step 1 of 3')
      await page.getByTestId('tour-skip').click()
      await expect(page.getByTestId('tour')).toHaveCount(0)
    })

    test('never in demo mode, and no replay row there', async ({page}) => {
      test.setTimeout(120_000)
      await page.goto('/')
      await openDemo(page)
      await armTour(page)
      /* A reload keeps the mode; the tour is armed but demo mode never runs it. */
      await page.reload()
      await appShown(page)
      await page.waitForTimeout(2500)
      await expect(page.getByTestId('tour')).toHaveCount(0)
      await page.goto('/settings/support')
      await expect(page.getByTestId('settings-help')).toBeVisible()
      await expect(page.getByTestId('settings-take-tour')).toHaveCount(0)
    })
  })
}

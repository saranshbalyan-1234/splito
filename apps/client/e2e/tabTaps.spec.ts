import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/* Owner 150 (§ 26.9): every tab tap switches at once, however fast; the newest tap wins. */
type Splito = {
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
}

const SCREEN: Record<string, string> = {
  home: 'screen-home',
  people: 'screen-people',
  groups: 'screen-groups',
  analytics: 'screen-analytics',
  activity: 'screen-activity',
}
const GAP = 50
/* From Home; the last tap repeats a tab tapped two taps (~100 ms) earlier, which a per-link debounce swallows. */
const SIX = ['groups', 'analytics', 'activity', 'groups', 'analytics', 'groups']
const TEN = [
  'activity', 'groups', 'home', 'analytics', 'people',
  'activity', 'home', 'groups', 'analytics', 'people',
]

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('screen-home')).toBeVisible()
  await page.waitForFunction(() => 'splito' in window)
}

function setMotion(page: Page, motion: 'full' | 'reduced') {
  return page.evaluate(
    m => (window as unknown as {splito: {setPref(k: string, v: unknown): Promise<void>}}).splito.setPref('motion', m),
    motion,
  )
}

async function centres(page: Page, ids: string[]) {
  const out: Record<string, {x: number; y: number}> = {}
  for (const id of ids) {
    const b = (await page.getByTestId(`tab-${id}`).boundingBox())!
    out[id] = {x: b.x + b.width / 2, y: b.y + b.height / 2}
  }
  return out
}

async function tapAll(page: Page, seq: string[], touch: boolean, gap = GAP) {
  const at = await centres(page, [...new Set(seq)])
  for (const id of seq) {
    const {x, y} = at[id]!
    if (touch) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)
    await page.waitForTimeout(gap)
  }
}

async function expectLanded(page: Page, last: string) {
  await expect(page.getByTestId(SCREEN[last]!)).toBeVisible()
  await expect(page.getByTestId(`tab-${last}`)).toHaveAttribute('aria-current', 'page')
  for (const other of Object.keys(SCREEN).filter(k => k !== last)) {
    await expect(page.getByTestId(`tab-${other}`)).not.toHaveAttribute('aria-current', 'page')
  }
  await expect(page).toHaveURL(last === 'home' ? /\/$/ : new RegExp(`/${last}$`))
}

for (const motion of ['full', 'reduced'] as const) {
  test.describe(`motion ${motion}`, () => {
    test.describe('phone, touch', () => {
      test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})
      for (const [name, seq] of [['six taps', SIX], ['ten-tap stress', TEN]] as const) {
        test(`${name} 50 ms apart end on the last tab (bottom bar)`, async ({page}) => {
          await ready(page)
          await setMotion(page, motion)
          await tapAll(page, seq as string[], true)
          await expectLanded(page, seq.at(-1)!)
        })
      }
      test('no tab widens the page while it mounts (the fixed bar would slip below the fold)', async ({page}) => {
        await ready(page)
        await setMotion(page, motion)
        await page.evaluate(() => {
          const w = window as unknown as {__widest: number}
          w.__widest = 0
          const frame = () => {
            w.__widest = Math.max(w.__widest, innerWidth, document.documentElement.scrollWidth)
            requestAnimationFrame(frame)
          }
          requestAnimationFrame(frame)
        })
        await tapAll(page, ['groups', 'analytics', 'activity', 'home', 'people', 'groups'], true, 120)
        await expectLanded(page, 'groups')
        expect(await page.evaluate(() => (window as unknown as {__widest: number}).__widest)).toBeLessThanOrEqual(390)
      })
      for (const gap of [0, 20]) {
        test(`taps ${gap} ms apart still end on the last tab`, async ({page}) => {
          await ready(page)
          await setMotion(page, motion)
          await tapAll(page, SIX, true, gap)
          await expectLanded(page, 'groups')
        })
      }
    })

    test.describe('desktop, mouse', () => {
      test.use({viewport: {width: 1440, height: 900}})
      for (const [name, seq] of [['six clicks', SIX], ['ten-click stress', TEN]] as const) {
        test(`${name} 50 ms apart end on the last tab (sidebar)`, async ({page}) => {
          await ready(page)
          await setMotion(page, motion)
          await tapAll(page, seq as string[], false)
          await expectLanded(page, seq.at(-1)!)
        })
      }
    })

    test.describe('rail, mouse', () => {
      test.use({viewport: {width: 900, height: 800}})
      test('six clicks 50 ms apart end on the last tab (rail)', async ({page}) => {
        await ready(page)
        await setMotion(page, motion)
        await tapAll(page, SIX, false)
        await expectLanded(page, 'groups')
      })
    })

    test.describe('in-page tabs', () => {
      test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})
      test('Group tabs: six taps 50 ms apart end on the last; Activity All / From others', async ({page}) => {
        await ready(page)
        await setMotion(page, motion)
        const group = await page.evaluate(async () => {
          const s = (window as unknown as {splito: Splito}).splito
          const b = await s.createPerson('Bela Joshi')
          return s.createGroup({name: 'Rishikesh', kind: 'trip', currency: 'INR', startDate: '2026-09-04', endDate: '2026-09-07', memberIds: [b]})
        })
        await page.goto(`/groups/${group}`)
        await expect(page.getByTestId('group-tabs')).toBeVisible()
        const ids = ['expenses', 'balances', 'members']
        const at: Record<string, {x: number; y: number}> = {}
        for (const id of ids) {
          const b = (await page.getByTestId(`group-tab-${id}`).boundingBox())!
          at[id] = {x: b.x + b.width / 2, y: b.y + b.height / 2}
        }
        for (const id of ['balances', 'members', 'expenses', 'members', 'balances', 'members']) {
          await page.touchscreen.tap(at[id]!.x, at[id]!.y)
          await page.waitForTimeout(GAP)
        }
        await expect(page.getByTestId('group-tab-members')).toHaveAttribute('aria-selected', 'true')
        for (const id of ['expenses', 'balances']) await expect(page.getByTestId(`group-tab-${id}`)).toHaveAttribute('aria-selected', 'false')
        // The list behind the bar follows the last tap, not only the bar: Members shows no Expenses heading...
        await expect(page.getByTestId('group-expenses-title')).toHaveCount(0)
        // ...and one more tap back to Expenses brings it back.
        await page.touchscreen.tap(at.expenses!.x, at.expenses!.y)
        await expect(page.getByTestId('group-tab-expenses')).toHaveAttribute('aria-selected', 'true')
        await expect(page.getByTestId('group-expenses-title')).toBeVisible()

        await page.goto('/activity')
        await expect(page.getByTestId('activity-tabs')).toBeVisible()
        // The seeded person and group are my own changes: All lists them, From others does not.
        const mine = page.getByTestId('screen-activity').locator('[data-testid^="activity-"][data-testid*="."]').filter({hasText: 'You added'})
        await expect(mine.first()).toBeVisible()
        const one = (await page.getByTestId('activity-tabs-selector-1').boundingBox())!
        const zero = (await page.getByTestId('activity-tabs-selector-0').boundingBox())!
        for (const b of [one, zero, one, zero, one]) {
          await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
          await page.waitForTimeout(GAP)
        }
        await expect(page.getByTestId('activity-tabs-selector-1')).toHaveAttribute('aria-selected', 'true')
        await expect(mine).toHaveCount(0)
      })
    })
  })
}

/*
 * Owner 150/166, found on a real iPhone: Analytics -> Home took 600 ms (5.9 s at 6x CPU) because popping a tab
 * unmounted it and every row ran its exit animation; Home answered only after that. A tab you left stays mounted.
 */
test.describe('phone: tabs stay mounted and answer in the first frame', () => {
  test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})

  const tap = async (page: Page, tab: string) => {
    const b = (await page.getByTestId(`tab-${tab}`).boundingBox())!
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  }

  test('a visited tab is not unmounted or rebuilt when you come back to it', async ({page}) => {
    await openDemo(page)
    await expect(page.getByTestId('screen-home')).toBeVisible()
    await tap(page, 'analytics')
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await page.evaluate(() => document.querySelector('[data-testid="screen-analytics"]')!.setAttribute('data-mark', 'kept'))
    await tap(page, 'home')
    await expect(page.getByTestId('screen-home')).toBeVisible()
    await tap(page, 'analytics')
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await expect(page.getByTestId('screen-analytics')).toHaveAttribute('data-mark', 'kept')
    // Browser Back still walks the history (Analytics -> Home), and forward comes back to the same tab.
    await page.goBack()
    await expect(page.getByTestId('screen-home')).toBeVisible()
    await expect(page.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page')
    await page.goForward()
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await expect(page.getByTestId('tab-analytics')).toHaveAttribute('aria-current', 'page')
  })

  for (const rate of [1, 6]) {
    test(`Home switch shows its shell in the first frame (CPU x${rate})`, async ({page}) => {
      // Open on Groups, so Home is cold: its first visit shows the header and the bar's highlight at once, the rows may follow.
      await openDemo(page, '/groups')
      await expect(page.getByTestId('screen-groups')).toBeVisible()
      await tap(page, 'analytics')
      await expect(page.getByTestId('screen-analytics')).toBeVisible()
      await page.waitForTimeout(1500)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', {rate})
      await page.evaluate(() => {
        const w = window as unknown as {__frames: Array<{t: number; screen: boolean; header: boolean; selected: boolean}>; __t0: number}
        w.__frames = []
        const shown = (id: string) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(e => e.getClientRects().length > 0)
        addEventListener('touchstart', () => (w.__t0 = performance.now()), {capture: true, once: true})
        const frame = () => {
          w.__frames.push({
            t: performance.now(),
            screen: shown('screen-home'),
            header: [...document.querySelectorAll('[data-testid="screen-home"] [data-testid="header-avatar"]')].some(e => e.getClientRects().length > 0),
            selected: document.querySelector('[data-testid="tab-home"]')?.getAttribute('aria-current') === 'page',
          })
          requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      })
      await tap(page, 'home')
      await expect(page.getByTestId('screen-home')).toBeVisible()
      await page.waitForTimeout(400)
      const {frames, t0} = await page.evaluate(() => {
        const w = window as unknown as {__frames: Array<{t: number; screen: boolean; header: boolean; selected: boolean}>; __t0: number}
        return {frames: w.__frames, t0: w.__t0}
      })
      const first = frames.find(f => f.t >= t0 && f.screen)
      expect(first, 'a frame with Home visible').toBeTruthy()
      // The tab's highlight, the screen and its header arrive in the same frame, never the screen before the rest.
      expect(first).toMatchObject({selected: true, header: true})
      // Never later than the budget (generous: the suite runs several workers on one machine).
      expect(first!.t - t0).toBeLessThan(rate === 1 ? 150 : 600)
    })
  }

  test('a parked tab the LRU had evicted comes back with its content (never a stand-in)', async ({page}) => {
    await openDemo(page)
    await expect(page.getByTestId('screen-home')).toBeVisible()
    for (const t of ['groups', 'analytics', 'activity']) {
      await tap(page, t)
      await expect(page.getByTestId(`screen-${t}`)).toBeVisible()
    }
    // Four pushed pages (four different routes) on top: the stack keeps only the most recent screens mounted, Groups falls out.
    for (const url of ['/settings', '/profile', '/settings/friends', '/settings/appearance']) {
      await page.evaluate(u => (window as unknown as {__splitoTest: {openLink(u: string): void}}).__splitoTest.openLink(u), url)
      await expect(page).toHaveURL(new RegExp(`${url}$`))
    }
    await tap(page, 'home')
    await expect(page.getByTestId('screen-home')).toBeVisible()
    await tap(page, 'groups')
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await expect(page.getByTestId('screen-groups').getByTestId('list-filters')).toBeVisible()
    await tap(page, 'analytics')
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
  })

  test('browser Back and Forward bring a tab back as it was, not rebuilt', async ({page}) => {
    await openDemo(page)
    await expect(page.getByTestId('screen-home')).toBeVisible()
    await tap(page, 'groups')
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.evaluate(() => document.querySelector('[data-testid="screen-groups"]')!.setAttribute('data-mark', 'kept'))
    await tap(page, 'analytics')
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await tap(page, 'home')
    await expect(page.getByTestId('screen-home')).toBeVisible()
    // Going Home popped two history entries, so Forward walks back through Groups and Analytics (a history reset).
    await page.goForward()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await expect(page.getByTestId('screen-groups')).toHaveAttribute('data-mark', 'kept')
    await page.goForward()
    await expect(page.getByTestId('screen-analytics')).toBeVisible()
    await page.goBack()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await expect(page.getByTestId('screen-groups')).toHaveAttribute('data-mark', 'kept')
    await page.goBack()
    await expect(page.getByTestId('screen-home')).toBeVisible()
  })

  /* A press-in acts at once; the activations that are not a press-in must still work (keyboard, screen reader, modified click). */
  test('the keyboard, a screen reader click and a cancelled press still switch tabs; a modified click stays in place', async ({page}) => {
    await openDemo(page)
    await expect(page.getByTestId('screen-home')).toBeVisible()

    // Keyboard: Enter on a focused tab link.
    await page.getByTestId('tab-groups').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('screen-groups')).toBeVisible()

    // A screen reader activates a link with a bare click event, no pointer press before it.
    await page.getByTestId('tab-analytics').evaluate(el => (el as HTMLElement).click())
    await expect(page.getByTestId('screen-analytics')).toBeVisible()

    // A press that is dragged off before it lifts has already acted at press-in; it must not leave the link
    // swallowing the next click-only activation.
    const box = (await page.getByTestId('tab-activity').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    // The finger rests a moment (the press-in has acted), then slides off before lifting.
    await page.waitForTimeout(150)
    await page.mouse.move(box.x + box.width / 2, 300)
    await page.mouse.up()
    await expect(page.getByTestId('screen-activity')).toBeVisible()
    await tap(page, 'home')
    await expect(page.getByTestId('screen-home')).toBeVisible()
    await page.waitForTimeout(1200)
    await page.getByTestId('tab-activity').evaluate(el => (el as HTMLElement).click())
    await expect(page.getByTestId('screen-activity')).toBeVisible()

    // Ctrl-click asks for a new tab: this page stays where it is.
    await tap(page, 'home')
    await expect(page.getByTestId('screen-home')).toBeVisible()
    const popup = page.context().waitForEvent('page', {timeout: 3000}).catch(() => null)
    await page.getByTestId('tab-groups').click({modifiers: ['Control']})
    ;(await popup)?.close()
    await page.waitForTimeout(300)
    await expect(page.getByTestId('screen-home')).toBeVisible()
    await expect(page.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page')
  })
})

import {expect, type Page, test} from '@playwright/test'

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
      test('Group tabs: six taps 50 ms apart end on the last; Activity All / Me / Others', async ({page}) => {
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
        // The seeded person and group are my own changes: All lists them, Others does not.
        const mine = page.getByTestId('screen-activity').locator('[data-testid^="activity-"][data-testid*="."]').filter({hasText: 'You added'})
        await expect(mine.first()).toBeVisible()
        const one = (await page.getByTestId('activity-tabs-selector-2').boundingBox())!
        const zero = (await page.getByTestId('activity-tabs-selector-0').boundingBox())!
        for (const b of [one, zero, one, zero, one]) {
          await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
          await page.waitForTimeout(GAP)
        }
        await expect(page.getByTestId('activity-tabs-selector-2')).toHaveAttribute('aria-selected', 'true')
        await expect(mine).toHaveCount(0)
      })
    })
  })
}

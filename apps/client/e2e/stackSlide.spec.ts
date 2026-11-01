import {expect, type Page, test} from '@playwright/test'

import {openDemo, setPref} from './openDemo'
import {DESKTOP, PHONE} from './viewports'

/*
 * Pushed pages slide like a native stack on phone web (owner 227, ARCHITECTURE 26.3, F-277): a push sets
 * `data-stack-in="push"` on the incoming screen's root and the CSS in index.html slides its content in from the right;
 * a Back sets "pop" on the page underneath. Rail and desktop stay instant, reduced motion is instant, and a Back the
 * browser's own swipe made (iOS Safari's left edge) is not animated twice. The attribute is set and cleared within a
 * few hundred ms, so a MutationObserver installed before the tap records each one as it is set.
 */

/* Demo mode seeds the large set first, which takes most of the default 30 s on a busy machine. */
test.describe.configure({timeout: 120_000})

type Seen = {
  screen: string
  value: string
  anim: string
  fabAnim: string | null
  fabX: number | null
}
type Win = {
  __slides?: Seen[]
  __widest?: number
  __fabXs?: number[]
  __observer?: MutationObserver
}

async function watchSlides(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as Win
    w.__slides = []
    w.__widest = 0
    w.__fabXs = []
    w.__observer?.disconnect()
    w.__observer = new MutationObserver(records => {
      for (const r of records) {
        const el = r.target as HTMLElement
        const value = el.dataset.stackIn
        if (r.attributeName !== 'data-stack-in' || !value) continue
        const content = [...el.children].find(
          c => !(c as HTMLElement).dataset.fab,
        )!
        const fab = el.querySelector<HTMLElement>(':scope > [data-fab]')
        w.__slides!.push({
          screen: el.dataset.testid ?? '',
          value,
          anim: getComputedStyle(content).animationName,
          fabAnim: fab ? getComputedStyle(fab).animationName : null,
          fabX: fab ? fab.getBoundingClientRect().x : null,
        })
      }
    })
    w.__observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-stack-in'],
    })
    /* The page's width and the FAB's place on every frame for the next second. */
    const until = performance.now() + 1000
    const tick = () => {
      w.__widest = Math.max(w.__widest!, document.documentElement.scrollWidth)
      const fab = document.querySelector<HTMLElement>(
        '[data-screen] > [data-fab]',
      )
      if (fab && fab.checkVisibility())
        w.__fabXs!.push(Math.round(fab.getBoundingClientRect().x))
      if (performance.now() < until) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

const slides = (page: Page) =>
  page.evaluate(() => (window as unknown as Win).__slides ?? [])
const widest = (page: Page) =>
  page.evaluate(() => (window as unknown as Win).__widest ?? 0)
const fabXs = (page: Page) =>
  page.evaluate(() => (window as unknown as Win).__fabXs ?? [])

async function openPeople(page: Page) {
  await openDemo(page)
  await expect(
    page.getByTestId('screen-people').getByTestId('header-avatar'),
  ).toBeVisible()
  // Settle the first load (its own focus is the first state, which never slides).
  await page.waitForTimeout(400)
}

async function avatarToProfile(page: Page) {
  await page.getByTestId('screen-people').getByTestId('header-avatar').click()
  await expect(page.getByTestId('screen-profile')).toBeVisible()
}

test.describe('stack slide, phone', () => {
  test.use({viewport: PHONE, hasTouch: true})

  test('avatar to Profile slides Profile in; Back slides People back; the page never widens, the FAB stays', async ({
    page,
  }) => {
    await openPeople(page)
    await watchSlides(page)
    await avatarToProfile(page)
    await expect
      .poll(() => slides(page))
      .toEqual([
        expect.objectContaining({
          screen: 'screen-profile',
          value: 'push',
          anim: 'splito-stack-push',
        }),
      ])
    expect(await widest(page)).toBeLessThanOrEqual(PHONE.width)
    // The attribute goes once the slide has ended.
    await expect(page.getByTestId('screen-profile')).not.toHaveAttribute(
      'data-stack-in',
      /.*/,
    )

    await watchSlides(page)
    await page.getByTestId('screen-profile').getByTestId('header-back').click()
    await expect(page.getByTestId('screen-people')).toBeVisible()
    await expect
      .poll(() => slides(page))
      .toEqual([
        expect.objectContaining({
          screen: 'screen-people',
          value: 'pop',
          anim: 'splito-stack-pop',
          fabAnim: 'none',
        }),
      ])
    await page.waitForTimeout(400)
    expect(await widest(page)).toBeLessThanOrEqual(PHONE.width)
    // The FAB is fixed and never carried by the slide: one place on every frame.
    const xs = await fabXs(page)
    expect(xs.length).toBeGreaterThan(5)
    expect(new Set(xs).size).toBe(1)
  })

  test('the browser Back button slides the page underneath back as well', async ({
    page,
  }) => {
    await openPeople(page)
    await avatarToProfile(page)
    await page.waitForTimeout(400)
    await watchSlides(page)
    await page.goBack()
    await expect(page.getByTestId('screen-people')).toBeVisible()
    await expect
      .poll(() => slides(page))
      .toEqual([
        expect.objectContaining({screen: 'screen-people', value: 'pop'}),
      ])
  })

  test("a Back made by Safari's left-edge swipe is not animated again", async ({
    page,
  }) => {
    await openPeople(page)
    await avatarToProfile(page)
    await page.waitForTimeout(400)
    await watchSlides(page)
    // As Safari does: a touch from the left edge moves right, the browser takes it (touchcancel), then history goes back.
    await page.evaluate(() => {
      const target = document.body
      const touch = (x: number) =>
        new Touch({identifier: 1, target, clientX: x, clientY: 400})
      target.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          touches: [touch(6)],
          changedTouches: [touch(6)],
        }),
      )
      target.dispatchEvent(
        new TouchEvent('touchmove', {
          bubbles: true,
          touches: [touch(90)],
          changedTouches: [touch(90)],
        }),
      )
      target.dispatchEvent(
        new TouchEvent('touchcancel', {
          bubbles: true,
          touches: [],
          changedTouches: [touch(90)],
        }),
      )
      history.back()
    })
    await expect(page.getByTestId('screen-people')).toBeVisible()
    await page.waitForTimeout(500)
    expect(await slides(page)).toEqual([])
  })

  test('a tab switch keeps its own slide, never the stack slide', async ({
    page,
  }) => {
    await openPeople(page)
    await watchSlides(page)
    await page.getByTestId('tab-groups').click()
    await expect(page.getByTestId('screen-groups')).toBeVisible()
    await page.getByTestId('tab-people').click()
    await expect(page.getByTestId('screen-people')).toBeVisible()
    await page.waitForTimeout(400)
    expect(await slides(page)).toEqual([])
  })

  test('reduced motion (the OS setting or Animations off) plays no slide', async ({
    page,
  }) => {
    await page.emulateMedia({reducedMotion: 'reduce'})
    await openPeople(page)
    await watchSlides(page)
    await avatarToProfile(page)
    await page.waitForTimeout(500)
    expect(await slides(page)).toEqual([])

    await page.emulateMedia({reducedMotion: 'no-preference'})
    await page.getByTestId('screen-profile').getByTestId('header-back').click()
    await setPref(page, 'motion', 'off')
    await page.waitForTimeout(300)
    await watchSlides(page)
    await avatarToProfile(page)
    await page.waitForTimeout(500)
    expect(await slides(page)).toEqual([])
  })
})

test.describe('stack slide, desktop', () => {
  test.use({viewport: DESKTOP})

  test('a push and a Back at 1440 are instant', async ({page}) => {
    await openPeople(page)
    await watchSlides(page)
    await avatarToProfile(page)
    await page.getByTestId('screen-profile').getByTestId('header-back').click()
    await expect(page.getByTestId('screen-people')).toBeVisible()
    await page.waitForTimeout(500)
    expect(await slides(page)).toEqual([])
  })
})

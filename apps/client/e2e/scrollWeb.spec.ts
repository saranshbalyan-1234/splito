import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * Mobile web scroll (ARCHITECTURE 26.4 and 26.10). Mobile Safari fires `resize`
 * whenever its toolbar collapses or returns while the page scrolls; the
 * safe-area provider then re-measured its rect in viewport coordinates and put
 * the scroll offset into the top inset, pushing the screen down by that much
 * (a blank page, the "flicker"). Fixed by the react-native-safe-area-context
 * patch; this spec keeps it fixed. Chromium has no toolbar, so it dispatches
 * the same `resize` the browser does.
 */

const PHONE = {width: 390, height: 844}

type Win = {__long?: number[]}

const screenPadTop = (page: Page) =>
  page.getByTestId('screen-people').evaluate(el => parseFloat(getComputedStyle(el).paddingTop))

async function openPeople(page: Page) {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  // The page's own scroll restoration swallows the first scroll event; settle first.
  await page.waitForTimeout(400)
}

test.describe('mobile web scroll', () => {
  test('a resize while scrolled never moves the screen (no blank page)', async ({page}) => {
    await openPeople(page)
    const top = await page.getByTestId('person-Arjun Mehta').boundingBox()
    expect(await screenPadTop(page)).toBeLessThan(1)

    for (const y of [600, 1500, 900, 0]) {
      await page.evaluate(y => window.scrollTo(0, y), y)
      await page.waitForTimeout(150)
      await page.evaluate(() => window.dispatchEvent(new Event('resize')))
      await page.waitForTimeout(300)
      expect(await screenPadTop(page), `inset after a resize at scrollY ${y}`).toBeLessThan(1)
    }
    const back = await page.getByTestId('person-Arjun Mehta').boundingBox()
    expect(Math.abs(back!.y - top!.y)).toBeLessThan(2)
  })

  test('touch scrolling People runs no JS long task over 50 ms and the header stays put on a resize', async ({
    page,
    context,
  }) => {
    await openPeople(page)
    await page.evaluate(() => {
      const w = window as unknown as Win
      w.__long = []
      new PerformanceObserver(l => l.getEntries().forEach(e => w.__long!.push(e.duration))).observe({
        entryTypes: ['longtask'],
      })
    })
    const cdp = await context.newCDPSession(page)
    const header = page.getByTestId('screen-people').getByTestId('header-avatar')
    for (let i = 0; i < 6; i++) {
      await cdp.send('Input.synthesizeScrollGesture', {
        x: 200,
        y: 700,
        yDistance: -600,
        speed: 1200,
        gestureSourceType: 'touch',
      })
    }
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1500)
    await expect.poll(async () => (await header.boundingBox())!.y).toBeLessThan(0)

    // The browser toolbar returning (a resize) neither shows the header nor moves the content.
    const row = page.locator('[data-testid^="person-"]:visible').first()
    const before = (await row.boundingBox())!.y
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    await page.waitForTimeout(400)
    expect(Math.abs((await row.boundingBox())!.y - before)).toBeLessThan(2)
    await expect.poll(async () => (await header.boundingBox())!.y).toBeLessThan(0)

    for (let i = 0; i < 6; i++) {
      await cdp.send('Input.synthesizeScrollGesture', {
        x: 200,
        y: 200,
        yDistance: 700,
        speed: 1500,
        gestureSourceType: 'touch',
      })
    }
    await expect.poll(async () => (await header.boundingBox())!.y).toBeGreaterThanOrEqual(0)
    const long = await page.evaluate(() => (window as unknown as Win).__long!)
    expect(Math.max(0, ...long), `long tasks: ${long.join(', ')}`).toBeLessThan(50)
  })
})

test('Back (as Safari\'s swipe does) shows the list at its own scroll from the first frame (owner 216)', async ({page}) => {
  await openPeople(page)
  await page.evaluate(() => window.scrollTo(0, 900))
  await page.waitForTimeout(300)
  const saved = await page.evaluate(() => window.scrollY)
  expect(saved).toBeGreaterThan(800)
  // Open a friend from the rows on screen, then come back by history, as a Back swipe does.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll<HTMLElement>('[data-testid="screen-people"] [data-testid^="person-"]')].find(el => {
      const r = el.getBoundingClientRect()
      return r.top > 150 && r.bottom < 650
    })!
    row.click()
  })
  await expect(page.getByTestId('screen-person')).toBeVisible()
  await page.waitForTimeout(300)
  const frames = await page.evaluate(
    () =>
      new Promise<{shown: boolean; y: number}[]>(resolve => {
        const out: {shown: boolean; y: number}[] = []
        const people = document.querySelector<HTMLElement>('[data-testid="screen-people"]')!
        const tick = () => {
          out.push({shown: people.checkVisibility(), y: Math.round(window.scrollY)})
          if (out.length < 20) requestAnimationFrame(tick)
          else resolve(out)
        }
        history.back()
        requestAnimationFrame(tick)
      }),
  )
  const shown = frames.filter(f => f.shown)
  expect(shown.length).toBeGreaterThan(5)
  // Every painted frame of the list is at its own offset: no frame at the friend page's scroll, then a jump.
  for (const f of shown) expect(Math.abs(f.y - saved)).toBeLessThan(3)
})

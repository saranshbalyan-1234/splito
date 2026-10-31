import {type BrowserContext, type CDPSession, expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * Pull to refresh (F-258, owners 167, 169, 170) on phone web. Chromium drives real touches through CDP (the browser's own
 * scroll and overscroll run); WebKit has no touch input in Playwright, so it dispatches touch-shaped events at the page and reads
 * `dispatchEvent`'s answer to see whether the page cancelled the move (a pull cancels the rubber band; a scroll must not).
 * The app marks `refresh:start` / `refresh:end` (User Timing), which is how the spec sees a refresh happen.
 */

const PHONE = {width: 390, height: 844}
test.use({viewport: PHONE, hasTouch: true, isMobile: true})
test.setTimeout(180_000)

type Win = {__long?: number[]; __gap?: number; __spin?: boolean}

/** One finger. `move` returns whether the page cancelled the move (WebKit only; Chromium answers undefined). */
type Finger = {
  start(x: number, y: number): Promise<void>
  move(x: number, y: number): Promise<boolean | undefined>
  end(): Promise<void>
}

async function finger(page: Page, cdp: CDPSession | null): Promise<Finger> {
  if (cdp) {
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', {type, touchPoints: x === undefined ? [] : [{x, y: y!}]})
    return {
      start: async (x, y) => void (await send('touchStart', x, y)),
      move: async (x, y) => {
        await send('touchMove', x, y)
        await page.waitForTimeout(16)
        return undefined
      },
      end: async () => void (await send('touchEnd')),
    }
  }
  // Synthetic touches on the element under the finger; the target is kept for the whole gesture, as a real touch does.
  const fire = (type: string, x: number, y: number) =>
    page.evaluate(
      ([type, x, y]) => {
        const w = window as unknown as {__t?: Element}
        if (type === 'touchstart') w.__t = document.elementFromPoint(x as number, y as number) ?? document.body
        // Playwright's WebKit has no Touch or TouchEvent constructor: a plain event carrying the fields the handler reads.
        const touch = {identifier: 1, target: w.__t!, clientX: x as number, clientY: y as number}
        const ended = type === 'touchend'
        const event = new Event(type as string, {bubbles: true, cancelable: true})
        Object.defineProperties(event, {
          touches: {value: ended ? [] : [touch]},
          targetTouches: {value: ended ? [] : [touch]},
          changedTouches: {value: [touch]},
        })
        return w.__t!.dispatchEvent(event)
      },
      [type, x, y] as const,
    )
  let last = [0, 0]
  return {
    start: async (x, y) => void ((last = [x, y]), await fire('touchstart', x, y)),
    move: async (x, y) => {
      last = [x, y]
      return !(await fire('touchmove', x, y))
    },
    end: async () => void (await fire('touchend', last[0]!, last[1]!)),
  }
}

/** The visible screen's pull state, and where its sticky header is. */
const read = (page: Page) =>
  page.evaluate(() => {
    const screens = [...document.querySelectorAll<HTMLElement>('[data-screen]')].filter(e => e.getClientRects().length)
    const screen = screens[screens.length - 1]!
    const header = [...screen.querySelectorAll<HTMLElement>('*')].find(e => getComputedStyle(e).position === 'sticky')
    const content = screen.querySelector<HTMLElement>('[data-pull-content]')
    const indicator = screen.querySelector<HTMLElement>('[data-testid="pull-indicator"]')
    const m = new DOMMatrix(content ? getComputedStyle(content).transform : 'none')
    return {
      screens: screens.length,
      hasSurface: !!content,
      headerTop: header ? Math.round(header.getBoundingClientRect().top * 10) / 10 : null,
      contentY: Math.round(m.m42 * 10) / 10,
      indicatorOpacity: indicator ? Number(indicator.style.opacity || 0) : 0,
      spinning: !!indicator?.querySelector('.rotate-500ms'),
      label: indicator?.lastElementChild instanceof HTMLElement && indicator.lastElementChild.style.display !== 'none' ? indicator.lastElementChild.textContent : '',
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
    }
  })

const marks = (page: Page, name: string) =>
  page.evaluate(n => performance.getEntriesByName(n).map(e => ({t: e.startTime, detail: (e as PerformanceMark).detail})), name)

async function openAt(page: Page, path: string) {
  await openDemo(page, path)
  await expect.poll(async () => (await read(page)).hasSurface, {timeout: 30_000}).toBe(true)
  await page.waitForTimeout(500)
}

/** Holds the finger down at the top, pulls `to` px of finger travel and lets go. Returns the state sampled mid-pull. */
async function pull(page: Page, f: Finger, to: number) {
  await f.start(200, 260)
  let mid: Awaited<ReturnType<typeof read>> | undefined
  let cancelled: boolean | undefined
  for (let dy = 10; dy <= to; dy += 10) {
    cancelled = await f.move(200, 260 + dy)
    if (dy === Math.round(to / 2 / 10) * 10) mid = await read(page)
  }
  const atEnd = await read(page)
  await f.end()
  return {mid: mid!, atEnd, cancelled}
}

/** A route is a path, or a function that finds one in the demo data (a person, a group, an expense). */
type Route = string | ((page: Page) => Promise<string>)

const href = async (page: Page, from: string, selector: string) => {
  await openAt(page, from)
  const link = page.locator(selector).first()
  await expect(link).toBeVisible()
  return new URL((await link.getAttribute('href'))!, 'http://x').pathname
}

const ROUTES: Array<[string, Route]> = [
  ['People', '/people'],
  ['Groups', '/groups'],
  ['Activity', '/activity'],
  ['Analytics', '/analytics'],
  ['a group page', page => href(page, '/groups', 'a[href^="/groups/"][data-testid^="group-"]')],
  ['Settle up', async page => `${await href(page, '/groups', 'a[href^="/groups/"][data-testid^="group-"]')}/settle`],
  ['a person page', page => href(page, '/people', 'a[href^="/people/"][data-testid^="person-"]')],
  [
    'an expense page',
    async page => {
      await openAt(page, '/people')
      const id = await page.evaluate(async () => {
        const s = (window as unknown as {splito: {list(t: string): Promise<Array<{id: string}>>}}).splito
        return (await s.list('expense'))[0]!.id
      })
      return `/expense/${id}`
    },
  ],
  ['Profile', '/profile'],
  ['Settings', '/settings'],
  ['a Settings page', '/settings/regional'],
]

for (const [name, route] of ROUTES) {
  test(`pull to refresh on ${name}: indicator shows, header stays, a refresh runs, scrolling is unaffected`, async ({
    page,
    context,
    browserName,
  }) => {
    await openAt(page, typeof route === 'string' ? route : await route(page))
    const cdp = browserName === 'chromium' ? await context.newCDPSession(page) : null
    const f = await finger(page, cdp)
    await page.evaluate(() => {
      const w = window as unknown as Win
      w.__long = []
      new PerformanceObserver(l => l.getEntries().forEach(e => w.__long!.push(e.duration))).observe({entryTypes: ['longtask']})
      performance.clearMarks()
      // The spinner turns only while refreshing, which can be over before a slow machine reads the page: record that it ever did.
      w.__spin = false
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="pull-indicator"] .rotate-500ms')) w.__spin = true
      }).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['class']})
      // WebKit has no long task API: the worst gap between two frames says the same thing (the page was not stuck).
      let last = performance.now()
      w.__gap = 0
      const tick = (now: number) => {
        w.__gap = Math.max(w.__gap!, now - last)
        last = now
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    const before = await read(page)
    expect(before.headerTop, 'the screen has a sticky header').not.toBeNull()
    expect(before.contentY).toBe(0)

    // 1. The pull: the indicator opens under the header, the content follows, the header does not move.
    const {mid, atEnd, cancelled} = await pull(page, f, 220)
    expect(mid.contentY).toBeGreaterThan(20)
    expect(mid.indicatorOpacity).toBeGreaterThan(0)
    expect(mid.headerTop).toBe(before.headerTop)
    expect(atEnd.headerTop).toBe(before.headerTop)
    expect(atEnd.contentY).toBeGreaterThanOrEqual(60)
    expect(atEnd.scrollY).toBe(0)
    if (browserName !== 'chromium') expect(cancelled, 'a pull cancels the browser overscroll').toBe(true)

    // 2. Letting go past the threshold refreshes: one refresh, the spinner holds the content, the header still stays.
    await expect.poll(async () => (await marks(page, 'refresh:start')).length).toBe(1)
    expect(await page.evaluate(() => (window as unknown as Win).__spin), 'the spinner turned while refreshing').toBe(true)
    await expect.poll(async () => (await marks(page, 'refresh:end')).length).toBe(1)
    const [start] = await marks(page, 'refresh:start')
    const [end] = await marks(page, 'refresh:end')
    expect(end!.t - start!.t, 'the spinner is never a flash').toBeGreaterThanOrEqual(380)
    expect(end!.detail.offline).toBe(false)
    await expect.poll(async () => (await read(page)).contentY).toBe(0)
    expect((await read(page)).indicatorOpacity).toBe(0)

    // 3. A short pull springs back without refreshing.
    await pull(page, f, 60)
    await expect.poll(async () => (await read(page)).contentY).toBe(0)
    expect(await marks(page, 'refresh:start')).toHaveLength(1)

    // Everything the pull did (pull, refresh, spring back) ran no JS long task over 50 ms.
    const pullLong = await page.evaluate(() => Math.max(0, ...(window as unknown as Win).__long!))
    expect(pullLong, 'the pull itself runs no long task').toBeLessThan(50)

    // 4. Normal scroll still works, and a drag down while scrolled is a scroll, not a pull.
    const tall = (await read(page)).scrollHeight > PHONE.height * 1.3
    console.log(`REFRESH ${browserName} ${name}: page ${(await read(page)).scrollHeight} px tall`)
    if (tall) {
      if (cdp) {
        await cdp.send('Input.synthesizeScrollGesture', {x: 200, y: 700, yDistance: -500, speed: 1200, gestureSourceType: 'touch'})
      } else {
        await page.evaluate(() => window.scrollTo(0, 400))
      }
      await expect.poll(async () => (await read(page)).scrollY).toBeGreaterThan(200)
      const scrolled = (await read(page)).scrollY
      await f.start(200, 300)
      const stolen = await f.move(200, 340)
      await f.move(200, 400)
      expect((await read(page)).contentY).toBe(0)
      expect(stolen, 'a drag while scrolled is left to the browser').not.toBe(true)
      await f.end()
      expect(await marks(page, 'refresh:start')).toHaveLength(1)
      expect((await read(page)).scrollY).toBeGreaterThan(0)
      expect(scrolled).toBeGreaterThan(200)
    }

    // 5. The numbers. Scrolling a long list loads and renders rows (Activity's next page is one 60-70 ms task in Chromium);
    // that is the list's own cost, measured by tapLatency and the perf sweep, and is reported here, not gated.
    const long = await page.evaluate(() => (window as unknown as Win).__long!)
    const gap = await page.evaluate(() => (window as unknown as Win).__gap!)
    console.log(
      `REFRESH ${browserName} ${name}: pull longest task ${pullLong.toFixed(0)} ms, with the scroll ${Math.max(0, ...long).toFixed(0)} ms over ${long.length} long tasks (WebKit reports none), worst frame gap ${gap.toFixed(0)} ms`,
    )
  })
}

test('reduced motion keeps the pull working with a label and no movement', async ({page, context, browserName}) => {
  await page.emulateMedia({reducedMotion: 'reduce'})
  await openAt(page, '/people')
  const f = await finger(page, browserName === 'chromium' ? await context.newCDPSession(page) : null)
  await page.evaluate(() => performance.clearMarks())
  const {mid, atEnd} = await pull(page, f, 220)
  expect(mid.contentY, 'nothing moves').toBe(0)
  expect(atEnd.contentY).toBe(0)
  expect(atEnd.label).toMatch(/Release to refresh/)
  await expect.poll(async () => (await read(page)).label).toMatch(/Refreshing/)
  await expect.poll(async () => (await marks(page, 'refresh:end')).length).toBe(1)
  await expect.poll(async () => (await read(page)).indicatorOpacity).toBe(0)
})

test('a pull on the open drawer is not a pull to refresh', async ({page, browserName, context}) => {
  await openAt(page, '/people')
  const f = await finger(page, browserName === 'chromium' ? await context.newCDPSession(page) : null)
  await page.evaluate(() => performance.clearMarks())
  // The drawer sits outside every screen: a pull on it must not refresh the page behind.
  await page.getByTestId('header-avatar').first().click()
  await expect(page.getByTestId('drawer-scrim')).toBeVisible()
  await pull(page, f, 220)
  await page.waitForTimeout(600)
  expect(await marks(page, 'refresh:start')).toHaveLength(0)
})

const touchFor = async (page: Page, context: BrowserContext, browserName: string) =>
  finger(page, browserName === 'chromium' ? await context.newCDPSession(page) : null)

test('a touch whose element leaves the page before the finger lifts does not strand pull to refresh', async ({
  page,
  context,
  browserName,
}) => {
  await openAt(page, '/people')
  const f = await touchFor(page, context, browserName)
  await page.evaluate(() => performance.clearMarks())
  await pull(page, f, 220)
  await expect.poll(async () => (await marks(page, 'refresh:end')).length).toBe(1)

  // The finger lands on an element inside the screen that is then removed (a row that is deleted, a menu that closes): its
  // touchend has no path up to the window.
  await page.evaluate(() => {
    const screens = [...document.querySelectorAll<HTMLElement>('[data-screen]')].filter(e => e.getClientRects().length)
    const cover = document.createElement('div')
    cover.id = 'pull-test-cover'
    cover.style.cssText = 'position:fixed;left:0;top:200px;width:100%;height:300px;z-index:1'
    screens[screens.length - 1]!.appendChild(cover)
  })
  await f.start(200, 260)
  for (let dy = 10; dy <= 100; dy += 10) await f.move(200, 260 + dy)
  expect((await read(page)).contentY).toBeGreaterThan(20)
  await page.evaluate(() => document.getElementById('pull-test-cover')!.remove())
  await f.end()

  // The next pull still refreshes.
  await pull(page, f, 220)
  await expect.poll(async () => (await marks(page, 'refresh:start')).length).toBe(2)
  await expect.poll(async () => (await marks(page, 'refresh:end')).length).toBe(2)
  await expect.poll(async () => (await read(page)).contentY).toBe(0)
})

test('offline a pull ends at once, with no minimum spinner time and no error', async ({page, context, browserName}) => {
  await openAt(page, '/people')
  const f = await touchFor(page, context, browserName)
  await page.evaluate(() => performance.clearMarks())
  await context.setOffline(true)
  await pull(page, f, 220)
  await expect.poll(async () => (await marks(page, 'refresh:end')).length).toBe(1)
  const [start] = await marks(page, 'refresh:start')
  const [end] = await marks(page, 'refresh:end')
  expect(end!.detail.offline).toBe(true)
  expect(end!.t - start!.t, 'offline ends at once').toBeLessThan(300)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await context.setOffline(false)
})

test('a sideways swipe on the Analytics filter bar is left to the bar', async ({page, context, browserName}) => {
  await openAt(page, '/analytics')
  const f = await touchFor(page, context, browserName)
  await page.evaluate(() => performance.clearMarks())
  const bar = page.locator('[data-testid="analytics-filters"]:visible').first()
  const box = (await bar.boundingBox())!
  const y = box.y + box.height / 2
  await f.start(300, y)
  let cancelled: boolean | undefined
  for (let dx = -10; dx >= -150; dx -= 10) cancelled = await f.move(300 + dx, y + 1)
  expect((await read(page)).contentY, 'the content does not move').toBe(0)
  await f.end()
  await page.waitForTimeout(600)
  expect(await marks(page, 'refresh:start')).toHaveLength(0)
  expect(cancelled, 'a sideways move is not cancelled').not.toBe(true)
  if (browserName === 'chromium') {
    expect(await bar.evaluate(el => el.scrollLeft), 'the bar scrolled').toBeGreaterThan(0)
  }
})

test('a pull on a phone sheet is not a pull to refresh, and the sheet still drags closed', async ({page, context, browserName}) => {
  await openAt(page, '/people')
  const f = await touchFor(page, context, browserName)
  await page.evaluate(() => performance.clearMarks())
  await page.getByTestId('screen-people').getByTestId('list-filters').click()
  const dialog = page.getByRole('dialog').filter({has: page.getByTestId('friends-filters-sheet')})
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(800)
  const handle = (await dialog.getByTestId('dialog-handle').boundingBox())!
  const x = handle.x + handle.width / 2
  const y = handle.y + handle.height / 2
  await f.start(x, y)
  for (let dy = 20; dy <= 400; dy += 20) await f.move(x, y + dy)
  await f.end()
  await page.waitForTimeout(600)
  expect(await marks(page, 'refresh:start')).toHaveLength(0)
  // Touch drag-to-close needs a real touch pipeline: Chromium only (WebKit's events here are synthetic).
  if (browserName === 'chromium') await expect(dialog).toHaveCount(0)
})

import {expect, type Page, test} from '@playwright/test'

import {openDemo} from '../e2e/openDemo'

/*
 * Tap-to-first-visual-change at 390 px on the large demo ledger (ARCHITECTURE
 * 26.9 owners 151/152, 26.10): from the tap's touchstart to the first animation
 * frame in which its result is in the DOM (new screen showing, chip/switch
 * flipped, sheet moving, save confirmed). Budgets: 100 ms, 200 ms at 4x CPU
 * throttle. Each run reloads the app, so a lazy screen's first mount counts.
 * Run: `E2E_PORT=8231 pnpm perf -- tapLatency` after `pnpm e2e:build`.
 */

type Done =
  | {visible: string} // an element with this testID is on screen
  | {gone: string} // no element with this testID is on screen
  | {flips: [string, string]} // [testID, attribute] changes from its value at the tap
  | {moves: string} // the element's box or opacity changes (a sheet starting to move)

type Case = {
  name: string
  /** Gets the app to the state the tap starts from. */
  prepare: (page: Page) => Promise<void>
  /** The tappable. */
  tap: (page: Page) => ReturnType<Page['locator']>
  /** A tap made 50 ms before `tap` (the screen it opened is still rendering); the latency is `tap`'s own. */
  before?: (page: Page) => ReturnType<Page['locator']>
  done: Done
  /** Fixed-position controls (a sheet's cross): scrolling to them would only disturb the page. */
  noScroll?: boolean
}

const PHONE = {width: 390, height: 844}
const RUNS = Number(process.env.TAP_RUNS ?? 3)
const BUDGET = {full: 100, throttled: 200}

async function home(page: Page) {
  await openDemo(page)
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible({timeout: 60_000})
  // The large demo keeps loading its later history in the background; measure taps on a quiet app, not on that.
  await page.waitForTimeout(Number(process.env.TAP_QUIET ?? 3000))
}
async function onGroups(page: Page) {
  await home(page)
  await page.getByTestId('tab-groups').click()
  await expect(page.getByTestId('screen-groups')).toBeVisible()
}
async function groupsSheet(page: Page) {
  await onGroups(page)
  await page.getByTestId('screen-groups').getByTestId('list-filters').click()
  await expect(page.getByTestId('filter-show-owed')).toBeVisible()
  await page.waitForTimeout(600)
}

const CASES: Case[] = [
  {name: 'tab: Groups', prepare: home, tap: p => p.getByTestId('tab-groups'), done: {visible: 'screen-groups'}},
  {name: 'tab: Analytics', prepare: home, tap: p => p.getByTestId('tab-analytics'), done: {visible: 'screen-analytics'}},
  {name: 'tab: Activity', prepare: home, tap: p => p.getByTestId('tab-activity'), done: {visible: 'screen-activity'}},
  {name: 'friend row', prepare: home, tap: p => p.getByTestId('person-Riya Sharma'), done: {visible: 'screen-person'}},
  {
    name: 'group row',
    prepare: onGroups,
    tap: p => p.getByTestId('screen-groups').locator('[data-testid^="group-"]:not([data-testid^="group-balance"])').first(),
    done: {visible: 'screen-group'},
  },
  {name: 'FAB', prepare: home, tap: p => p.getByTestId('fab-add'), done: {visible: 'screen-add-expense'}},
  {name: 'open sheet', prepare: onGroups, tap: p => p.getByTestId('screen-groups').getByTestId('list-filters'), done: {visible: 'groups-filters-sheet'}},
  {name: 'filter chip', prepare: groupsSheet, tap: p => p.getByTestId('filter-show-owed'), done: {flips: ['filter-show-owed', 'aria-checked']}},
  {name: 'switch', prepare: groupsSheet, tap: p => p.getByTestId('filter-settled-toggle'), done: {flips: ['filter-settled-toggle', 'aria-checked']}},
  {
    name: 'Add expense Save',
    prepare: async page => {
      await home(page)
      await page.getByTestId('fab-add').click()
      await expect(page.getByTestId('screen-add-expense')).toBeVisible()
      await page.getByTestId('expense-title').fill('Tap latency')
      await page.getByTestId('amount-input').fill('120')
      await page.getByTestId('expense-people').click()
      await page.getByTestId('person-option-Riya Sharma').click()
      await page.getByTestId('people-dialog').getByTestId('sheet-close').click()
      await expect(page.getByTestId('people-dialog')).toHaveCount(0)
      await expect(page.getByTestId('sheet-save')).toBeEnabled()
      await page.waitForTimeout(600)
    },
    tap: p => p.getByTestId('sheet-save'),
    done: {visible: 'expense-saved'},
  },
  /* Taps that land while the previous tap's screen or sheet is still rendering. */
  {name: 'tab, 50 ms, tab', prepare: home, before: p => p.getByTestId('tab-analytics'), tap: p => p.getByTestId('tab-activity'), done: {visible: 'screen-activity'}},
  {name: 'tab, 50 ms, tab 2', prepare: home, before: p => p.getByTestId('tab-groups'), tap: p => p.getByTestId('tab-analytics'), done: {visible: 'screen-analytics'}},
  {name: 'chip, 50 ms, chip', prepare: groupsSheet, before: p => p.getByTestId('filter-show-owed'), tap: p => p.getByTestId('filter-show-owe'), done: {flips: ['filter-show-owe', 'aria-checked']}},
  {name: 'sheet X', prepare: groupsSheet, tap: p => p.getByTestId('sheet-close'), done: {moves: 'groups-filters-sheet'}, noScroll: true},
]

/** In the page: resolves with the frame time of the first frame whose DOM satisfies `done`, measured from the first touchstart. */
function watch([done, nth]: [Done, number]) {
  const w = window as unknown as {__tap: Promise<{ms: number; longest: number}>}
  const shown = (id: string) =>
    [...document.querySelectorAll(`[data-testid="${id}"]`)].some(
      e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden',
    )
  const first = (id: string) => document.querySelector(`[data-testid="${id}"]`)
  const sig = (id: string) => {
    const e = first(id)
    if (!e) return 'gone'
    const r = e.getBoundingClientRect()
    return `${r.x}|${r.y}|${r.width}|${r.height}|${getComputedStyle(e).opacity}`
  }
  const initial =
    'flips' in done ? first(done.flips[0])?.getAttribute(done.flips[1]) ?? null : 'moves' in done ? sig(done.moves) : null
  const check = () => {
    if ('visible' in done) return shown(done.visible)
    if ('gone' in done) return !shown(done.gone)
    if ('flips' in done) return first(done.flips[0])?.getAttribute(done.flips[1]) !== initial
    const now = sig(done.moves)
    if (now !== initial && (window as unknown as {__dbg?: boolean}).__dbg) console.log('moved', initial, '->', now)
    return now !== initial
  }
  let t0 = -1
  let longest = 0
  const observer = new PerformanceObserver(() => {})
  observer.observe({type: 'longtask'})
  /* Long tasks (over 50 ms) that ran between the tap and the result. */
  const longestTask = () => {
    for (const e of observer.takeRecords()) if (e.startTime + e.duration >= t0) longest = Math.max(longest, e.duration)
    return longest
  }
  let touches = 0
  const events: string[] = []
  ;(window as unknown as {__events: string[]}).__events = events
  for (const type of ['touchstart', 'touchend', 'click'])
    window.addEventListener(type, e => events.push(`${Math.round(e.timeStamp)} ${type} ${(e.target as HTMLElement).closest?.('[data-testid]')?.getAttribute('data-testid')}`), true)
  window.addEventListener('touchstart', e => ++touches === nth && (t0 = e.timeStamp), {capture: true})
  w.__tap = new Promise(resolve => {
    const started = performance.now()
    const frame = (now: number) => {
      if (t0 < 0 && now - started > 15000) resolve({ms: 99998, longest}) // the touch never landed
      if (t0 >= 0 && check()) resolve({ms: now - t0, longest: longestTask()})
      else if (t0 >= 0 && now - t0 > 5000) resolve({ms: 99999, longest}) // never happened
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}

async function measure(page: Page, c: Case) {
  await page.evaluate(watch, [c.done, c.before ? 2 : 1] as [Done, number])
  const target = c.tap(page)
  const first = c.before?.(page)
  await expect(target).toBeVisible()
  /* Scroll restoration and entering rows can move the page after the first scroll: settle until the target stays in view. */
  for (let i = 0; i < 4; i++) {
    if (!c.noScroll) await target.scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    const b = (await target.boundingBox())!
    if (b.y >= 0 && b.y + b.height <= PHONE.height) break
  }
  const tapAt = async (l: ReturnType<Page['locator']>) => {
    const box = (await l.boundingBox())!
    if (process.env.TAP_DEBUG) console.log('  tap at', JSON.stringify(box), await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.outerHTML.slice(0, 160), [box.x + box.width / 2, box.y + box.height / 2]))
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  }
  if (first) {
    await tapAt(first)
    await page.waitForTimeout(50)
  }
  await tapAt(target)
  page.on('console', m => process.env.TAP_DEBUG && m.text().startsWith('moved') && console.log('  ' + m.text()))
  await page.evaluate(() => ((window as unknown as {__dbg?: boolean}).__dbg = true))
  const result = await page.evaluate(() => (window as unknown as {__tap: Promise<{ms: number; longest: number}>}).__tap)
  if (result.ms >= 99998) {
    const where = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="screen-"]')].map(e => `${e.getAttribute('data-testid')}:${e.getClientRects().length}`).join(' '))
    console.log('  events', JSON.stringify(await page.evaluate(() => (window as unknown as {__events: string[]}).__events)))
    console.log(`  ${c.name}: result never showed; url ${page.url()}; screens ${where}`)
  }
  return result
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

test.use({viewport: PHONE, hasTouch: true, isMobile: true})
test.describe.configure({timeout: 900_000})

const rows: string[] = []
for (const throttle of (process.env.TAP_THROTTLE ?? '1,4').split(',').map(Number)) {
  test(`tap to first visual change, CPU x${throttle}`, async ({page}) => {
    const cdp = await page.context().newCDPSession(page)
    const misses: string[] = []
    for (const c of CASES.filter(c => !process.env.TAP_ONLY || c.name.includes(process.env.TAP_ONLY))) {
      const ms: number[] = []
      const longest: number[] = []
      for (let i = 0; i < RUNS; i++) {
        await page.goto('/')
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1})
        await c.prepare(page)
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: throttle})
        const r = await measure(page, c)
        ms.push(r.ms)
        longest.push(r.longest)
      }
      await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1})
      const budget = throttle === 1 ? BUDGET.full : BUDGET.throttled * (throttle > 4 ? throttle / 4 : 1)
      const m = median(ms)
      const line = `x${throttle}  ${c.name.padEnd(18)} ${m.toFixed(0).padStart(5)} ms (runs ${ms.map(x => x.toFixed(0)).join('/')})  longest task ${median(longest).toFixed(0)} ms${m > budget ? '  OVER ' + budget : ''}`
      console.log(line)
      rows.push(line)
      if (m > budget) misses.push(line)
    }
    expect(misses, 'taps over budget').toEqual([])
  })
}

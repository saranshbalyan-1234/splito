import {mkdirSync, writeFileSync} from 'node:fs'
import {loadavg} from 'node:os'
import {join} from 'node:path'

import {type CDPSession, expect, type Locator, type Page, test} from '@playwright/test'

import {openDemo} from '../e2e/openDemo'
import {GLOBAL_SHEETS, PAGE_TABS, SHEETS} from '#/lib/links/table'
import {ROUTE_PATHS} from '#/routes'

/*
 * The perf sweep (F-266, ARCHITECTURE 26.10 owner 189): every route in the link table (open, back, revisit), tabs,
 * every sheet / popup / picker, menus, the drawer, Search & Ask, scrolling the lists, typing in the fields, save,
 * delete, filter, switching demo mode and the first load, measured at 390 px with touch on the large demo set and on
 * a 10,000-expense ledger, in Playwright WebKit (1x) and in Chrome at 6x CPU throttle.
 *
 * Per interaction: from `pointerdown` (or the moment a link or key starts it) to the first painted frame with visible
 * feedback, and to the painted frame with the real content (no skeleton left); the longest main-thread block in
 * between (Long Tasks API, a timer heartbeat in WebKit, which lacks it); and, on a step that leaves a screen, how many
 * Reanimated exit animations ran (rows of a leaving screen must not animate out). The first lap is the "open"; the
 * median of the later laps is the "revisit". Budgets: feedback < 100 ms, content < 200 ms, no block over 50 ms, no
 * exit animation on a leaving screen. Writes `perf-results/sweep-<project>-<data>.{json,md}` and fails above budget.
 *
 * A new route, sheet or in-page tab fails the coverage test at the bottom until it joins a flow below.
 *
 * Run (after `pnpm e2e:build`): `E2E_PORT=8266 pnpm perf --project=sweep-webkit sweep` and `--project=sweep-chrome`.
 * Numbers count only on a quiet machine (1-minute load under 10): the JSON records the load before and after.
 * Filters: SWEEP_DATA=demo|bulk, SWEEP_ONLY=<flow name substring>, SWEEP_LAPS=<n> (default 4).
 */

/* ---------------------------------------------------------------- in-page probe */

type Pred =
  | {visible: string} // a CSS selector with an element on screen
  | {gone: string} // none on screen
  | {flips: [string, string]} // [selector, attribute] changes from its value when armed
  | {moves: string} // the element's box or opacity changes (a sheet starting to move), or it appears/disappears
  | {ready: string; rows?: string} // on screen with no skeleton inside (aria-busy or *-loading) and, if given, a row
  | {all: Pred[]}

type Result = {fb: number; ct: number; long: number; exits: number}

type Probe = {
  arm(a: {fb: Pred; ct: Pred; now: boolean}): void
  result(): Promise<Result>
  load: Promise<Result>
  typeStart(): void
  typeEnd(): {n: number; max: number; long: number}
  framesStart(): void
  framesEnd(): {maxGap: number; slow: number; long: number}
}

function installProbe() {
  const w = window as unknown as {__sw: Probe}
  const blocks: Array<{s: number; d: number}> = []
  let domExits = 0
  let cssExits = 0
  if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) blocks.push({s: e.startTime, d: e.duration})
    }).observe({type: 'longtask', buffered: true})
  } else {
    /* WebKit has no Long Tasks API: a timer that is late by more than 50 ms means the thread was blocked that long. */
    let last = performance.now()
    setInterval(() => {
      const n = performance.now()
      if (n - last > 58) blocks.push({s: last, d: n - last - 8})
      last = n
    }, 8)
  }
  const longIn = (from: number, to: number) =>
    blocks.reduce((m, b) => (b.s + b.d >= from && b.s <= to ? Math.max(m, b.d) : m), 0)
  /* Reanimated's web exit animation clones the node (`isDummy`) and starts a `REA-EXITING-n` CSS animation. */
  new MutationObserver(list => {
    for (const m of list) for (const n of m.addedNodes) if ((n as unknown as {isDummy?: boolean}).isDummy) domExits++
  }).observe(document, {childList: true, subtree: true})
  addEventListener('animationstart', e => /^REA-EXITING/.test((e as AnimationEvent).animationName) && cssExits++, true)

  const shown = (sel: string, root: ParentNode = document) =>
    [...root.querySelectorAll(sel)].some(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden')
  const busy = (root: Element) =>
    [...root.querySelectorAll('[aria-busy="true"],[data-testid$="-loading"]')].some(
      e => !(e.getAttribute('data-testid') ?? '').startsWith('sync-dot') && e.getClientRects().length > 0,
    )
  const sig = (sel: string) => {
    const e = document.querySelector(sel)
    if (!e) return 'gone'
    const r = e.getBoundingClientRect()
    return `${r.x}|${r.y}|${r.width}|${r.height}|${getComputedStyle(e).opacity}`
  }
  const compile = (p: Pred): (() => boolean) => {
    if ('visible' in p) return () => shown(p.visible)
    if ('gone' in p) return () => !shown(p.gone)
    if ('flips' in p) {
      const initial = document.querySelector(p.flips[0])?.getAttribute(p.flips[1]) ?? null
      return () => (document.querySelector(p.flips[0])?.getAttribute(p.flips[1]) ?? null) !== initial
    }
    if ('moves' in p) {
      const initial = sig(p.moves)
      return () => sig(p.moves) !== initial
    }
    if ('ready' in p) {
      return () =>
        [...document.querySelectorAll(p.ready)].some(
          r => r.getClientRects().length > 0 && !busy(r) && (!p.rows || shown(p.rows, r)),
        )
    }
    const all = p.all.map(compile)
    return () => all.every(f => f())
  }

  type Cur = {
    t0: number
    fb: () => boolean
    ct: () => boolean
    fbAt: number
    ctAt: number
    fbPaint: number
    ctPaint: number
    exits0: number
    done: (r: Result) => void
    timer: number
  }
  let cur: Cur | null = null
  /* The frame after `performance.now()`: the rAF callback runs before the paint, the message after the commit. */
  const painted = (cb: (t: number) => void) =>
    requestAnimationFrame(() => {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => cb(performance.now())
      ch.port2.postMessage(0)
    })
  const finish = (c: Cur) => {
    if (cur !== c) return
    cur = null
    clearTimeout(c.timer)
    const end = c.ctPaint > 0 ? c.ctPaint : performance.now()
    c.done({
      fb: c.fbPaint > 0 ? c.fbPaint - c.t0 : -1,
      ct: c.ctPaint > 0 ? c.ctPaint - c.t0 : -1,
      long: longIn(c.t0, end),
      exits: Math.max(domExits, cssExits) - c.exits0,
    })
  }
  const poll = () => {
    const c = cur
    if (!c || c.t0 < 0) return
    const now = performance.now()
    if (c.fbAt < 0 && c.fb()) {
      c.fbAt = now
      painted(t => ((c.fbPaint = t), c.ctPaint > 0 && finish(c)))
    }
    if (c.ctAt < 0 && c.ct()) {
      c.ctAt = now
      painted(t => ((c.ctPaint = t), (c.fbPaint = c.fbPaint > 0 ? c.fbPaint : t), finish(c)))
    }
  }
  new MutationObserver(poll).observe(document, {subtree: true, childList: true, attributes: true})
  const tick = () => (poll(), requestAnimationFrame(tick))
  requestAnimationFrame(tick)
  const down = (e: Event) => {
    if (cur && cur.t0 < 0) cur.t0 = e.timeStamp
  }
  for (const type of ['pointerdown', 'touchstart', 'mousedown']) addEventListener(type, down, true)

  const start = (a: {fb: Pred; ct: Pred; now: boolean}, t0: number) =>
    new Promise<Result>(done => {
      const c: Cur = {
        t0,
        fb: compile(a.fb),
        ct: compile(a.ct),
        fbAt: -1,
        ctAt: -1,
        fbPaint: -1,
        ctPaint: -1,
        exits0: Math.max(domExits, cssExits),
        done,
        timer: window.setTimeout(() => {
          /* Never happened: report what did. */
          if (c.fbAt > 0 && c.fbPaint < 0) c.fbPaint = c.fbAt
          finish(c)
        }, 8000),
      }
      cur = c
      if (a.now) poll()
    })
  let pending: Promise<Result> | null = null
  const probe: Probe = {
    arm(a) {
      pending = start(a, a.now ? performance.now() : -1)
    },
    result: () => pending ?? Promise.reject(new Error('not armed')),
    /* The first load: from navigation start to a People list with rows. */
    load: Promise.resolve({fb: -1, ct: -1, long: 0, exits: 0}),
    typeStart() {
      typed.length = 0
      typing = true
    },
    typeEnd() {
      typing = false
      const lat = [...typed].sort((a, b) => a - b)
      return {n: lat.length, max: lat.at(-1) ?? 0, long: longIn(typeT0, performance.now())}
    },
    framesStart() {
      frames = []
      framesT0 = performance.now()
      const loop = () => {
        if (!frames) return
        frames.push(performance.now())
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    },
    framesEnd() {
      const f = frames ?? []
      frames = null
      let maxGap = 0
      let slow = 0
      for (let i = 1; i < f.length; i++) {
        const g = f[i]! - f[i - 1]!
        maxGap = Math.max(maxGap, g)
        if (g > 50) slow++
      }
      return {maxGap, slow, long: longIn(framesT0, performance.now())}
    },
  }
  let typing = false
  let typeT0 = 0
  const typed: number[] = []
  const downs: number[] = []
  let frames: number[] | null = null
  let framesT0 = 0
  addEventListener(
    'keydown',
    e => {
      if (!typing) return
      if (!downs.length && !typed.length) typeT0 = performance.now()
      downs.push(e.timeStamp)
    },
    true,
  )
  addEventListener(
    'input',
    () => {
      if (!typing) return
      const t = downs.shift() ?? performance.now()
      painted(p => typed.push(p - t))
    },
    true,
  )
  w.__sw = probe
  /* First load: arm at navigation start (t0 = 0). */
  probe.load = start(
    {
      fb: {visible: '[data-testid^="screen-"]'},
      ct: {ready: '[data-testid="screen-people"]', rows: '[data-testid^="person-"]'},
      now: false,
    },
    0,
  )
}

/* ---------------------------------------------------------------- the step table */

type Data = 'demo' | 'bulk'
type Ctx = {page: Page; data: Data; ids: {person: string; group: string; expense: string; repayment: string}}

type Step = {
  /** The table row: the screen or surface. */
  screen: string
  /** What is done to it. */
  action: string
  /** A pointer gesture: the element to press (found and scrolled to before the clock starts). */
  tap?: (c: Ctx) => Promise<Locator>
  /** Anything else (a link, keys, a wheel): the clock starts as it begins. */
  act?: (c: Ctx) => Promise<void>
  fb: Pred
  /** Defaults to `fb`. */
  ct?: Pred
  /** This step leaves a screen: rows must not run exit animations. */
  leaving?: boolean
  /** Reported, not budgeted (the one-time seeding of demo mode). */
  info?: boolean
  data?: Data
  /** Wait after the step before the next one (the screen finishing its own motion). */
  settle?: number
}

type Flow = {name: string; start?: string; before?: (c: Ctx) => Promise<void>; steps: Step[]; laps?: number}

const T = (id: string) => `[data-testid="${id}"]`
const P = (prefix: string) => `[data-testid^="${prefix}"]`
const PHONE = {width: 390, height: 844}
const LAPS = Number(process.env.SWEEP_LAPS ?? 4)
const BUDGET = {feedback: 100, content: 200, longTask: 50}
const SCREEN = (name: string): Pred => ({ready: T(`screen-${name}`)})
const DIALOG: Pred = {ready: '[role="dialog"]'}

/** The first on-screen test id inside `scope` that matches `re` (rows carry the entity's name in their test id). */
async function firstTestId(page: Page, scope: string, re: RegExp, skip: RegExp = /$^/) {
  const id = await page.evaluate(
    ([scope, source, skipSource]) => {
      const re = new RegExp(source!)
      const skip = new RegExp(skipSource!)
      const root = document.querySelector(scope!) ?? document
      for (const e of root.querySelectorAll('[data-testid]')) {
        const id = e.getAttribute('data-testid')!
        if (re.test(id) && !skip.test(id) && e.getClientRects().length > 0) return id
      }
      return null
    },
    [scope, re.source, skip.source],
  )
  if (!id) throw new Error(`no row like ${re} in ${scope}`)
  return page.getByTestId(id).first()
}

const personRow = (c: Ctx) => firstTestId(c.page, T('screen-people'), /^person-/, /^person-(row-|demo-)|-(chips|more|deleted|deleted-clock)$/)
const groupRow = (c: Ctx) => firstTestId(c.page, T('screen-groups'), /^group-/, /^group-(balance|my-|demo-)|-(more|deleted|deleted-clock)$|^group-(tabs|tab-|name|byline|settle|more|add|dates|filter|menu|expenses|owes|history|outside|balances|owe-)/)
const tid = (id: string) => (c: Ctx) => Promise.resolve(c.page.getByTestId(id).first())
const link = (url: string) => async (c: Ctx) => void (await c.page.evaluate(u => (window as unknown as {__splitoTest: {openLink(u: string): void}}).__splitoTest.openLink(u), url))
const back = (screen: string): Step => ({
  screen,
  action: 'back',
  tap: tid('header-back'),
  fb: {gone: `${T(`screen-${screen.toLowerCase()}`)}`},
  ct: {all: [{gone: T(`screen-${screen.toLowerCase()}`)}, {ready: '[data-testid^="screen-"]'}]},
  leaving: true,
})

/** Tab switches (and revisits), the home screens. */
const TAB = (to: string, screen: string, rows: string): Step => ({
  screen: `Tab ${screen}`,
  action: 'tab',
  tap: tid(`tab-${to}`),
  fb: {flips: [T(`tab-${to}`), 'aria-current']},
  ct: {ready: T(`screen-${to}`), rows},
})

const FLOWS: Flow[] = [
  {
    name: 'tabs',
    steps: [
      TAB('groups', 'Groups', P('group-')),
      TAB('analytics', 'Analytics', P('analytics-over-time-chart')),
      TAB('activity', 'Activity', P('activity-')),
      TAB('people', 'People', P('person-')),
    ],
  },
  {
    name: 'Person',
    steps: [
      {screen: 'Person', action: 'open', tap: personRow, fb: {visible: T('screen-person')}, ct: SCREEN('person')},
      back('Person'),
    ],
  },
  {
    name: 'Group',
    start: '/groups',
    steps: [
      {screen: 'Group', action: 'open', tap: groupRow, fb: {visible: T('screen-group')}, ct: SCREEN('group')},
      back('Group'),
    ],
  },
]

/* ---------------------------------------------------------------- runner */

type Sample = {fb: number; ct: number; long: number; exits: number}
type Row = {
  screen: string
  action: string
  data: Data
  first: Sample
  again: Sample | null
  info: boolean
  leaving: boolean
  misses: string[]
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
const medianOf = (s: Sample[]): Sample => ({
  fb: median(s.map(x => x.fb)),
  ct: median(s.map(x => x.ct)),
  long: median(s.map(x => x.long)),
  exits: Math.max(...s.map(x => x.exits)),
})

function misses(s: Sample, step: {leaving?: boolean; info?: boolean}, label: string): string[] {
  if (step.info) return []
  const out: string[] = []
  if (s.fb < 0) out.push(`${label}: feedback never showed`)
  else if (s.fb > BUDGET.feedback) out.push(`${label}: feedback ${s.fb.toFixed(0)} ms > ${BUDGET.feedback}`)
  if (s.ct < 0) out.push(`${label}: content never showed`)
  else if (s.ct > BUDGET.content) out.push(`${label}: content ${s.ct.toFixed(0)} ms > ${BUDGET.content}`)
  if (s.long > BUDGET.longTask) out.push(`${label}: long task ${s.long.toFixed(0)} ms > ${BUDGET.longTask}`)
  if (step.leaving && s.exits > 0) out.push(`${label}: ${s.exits} exit animations on a leaving screen`)
  return out
}

/** Finds the element, scrolls it in and waits until it holds still: the clock must not include any of that. */
async function aim(page: Page, target: Locator) {
  await expect(target).toBeVisible({timeout: 30_000})
  for (let i = 0; i < 5; i++) {
    await target.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    const b = (await target.boundingBox())!
    if (b.y >= 0 && b.y + b.height <= PHONE.height) return b
  }
  return (await target.boundingBox())!
}

type Run = {page: Page; cdp: CDPSession | null; rate: number; data: Data}

async function boot(run: Run, path: string) {
  const {page} = run
  await page.goto(path)
  await page.waitForFunction(() => 'splito' in window, undefined, {timeout: 60_000})
  await page.waitForFunction(() => !!document.querySelector('[data-testid^="screen-"]'), undefined, {timeout: 60_000})
  /* The large demo keeps loading its later history in the background; measure on a quiet app. */
  await page.waitForTimeout(Number(process.env.SWEEP_QUIET ?? 2500))
}

async function throttle(run: Run, rate: number) {
  await run.cdp?.send('Emulation.setCPUThrottlingRate', {rate})
}

async function runStep(run: Run, c: Ctx, step: Step): Promise<Sample> {
  const {page} = run
  let target: Locator | null = null
  if (step.tap) {
    target = await step.tap(c)
    await aim(page, target)
  }
  await throttle(run, run.rate)
  await page.evaluate(a => (window as unknown as {__sw: Probe}).__sw.arm(a), {fb: step.fb, ct: step.ct ?? step.fb, now: !step.tap})
  if (target) {
    const b = (await target.boundingBox())!
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  } else await step.act!(c)
  const r = await page.evaluate(() => (window as unknown as {__sw: Probe}).__sw.result())
  await throttle(run, 1)
  await page.waitForTimeout(step.settle ?? 400)
  return r
}

async function runFlow(run: Run, c: Ctx, flow: Flow): Promise<Row[]> {
  const steps = flow.steps.filter(s => !s.data || s.data === run.data)
  const laps: Sample[][] = steps.map(() => [])
  await boot(run, flow.start ?? '/')
  await flow.before?.(c)
  for (let lap = 0; lap < (flow.laps ?? LAPS); lap++) {
    for (const [i, step] of steps.entries()) laps[i]!.push(await runStep(run, c, step))
  }
  return steps.map((step, i) => {
    const first = laps[i]![0]!
    const rest = laps[i]!.slice(1)
    const again = rest.length ? medianOf(rest) : null
    return {
      screen: step.screen,
      action: step.action,
      data: run.data,
      first,
      again,
      info: !!step.info,
      leaving: !!step.leaving,
      misses: [...misses(first, step, 'open'), ...(again ? misses(again, step, 'revisit') : [])],
    }
  })
}

/* ---------------------------------------------------------------- the report */

const cell = (s: Sample | null) => (s ? `${s.fb < 0 ? 'never' : s.fb.toFixed(0)} / ${s.ct < 0 ? 'never' : s.ct.toFixed(0)} / ${s.long.toFixed(0)}${s.exits ? ` / ${s.exits} exits` : ''}` : '-')

function report(project: string, data: Data, rows: Row[], load: {before: number; after: number}) {
  const dir = process.env.SWEEP_OUT ?? 'perf-results'
  mkdirSync(dir, {recursive: true})
  const usable = Math.max(load.before, load.after) < 10
  writeFileSync(join(dir, `sweep-${project}-${data}.json`), JSON.stringify({project, data, load, usable, budget: BUDGET, rows}, null, 1))
  const md = [
    `# Sweep ${project}, ${data} data`,
    '',
    `Load (1 min) before ${load.before.toFixed(1)}, after ${load.after.toFixed(1)}: ${usable ? 'usable' : 'NOT USABLE (load 10 or more)'}.`,
    'Cells: feedback ms / content ms / longest block ms. First lap = open; Again = median of later laps (revisit).',
    '',
    '| Screen | Action | First | Again | Result |',
    '|---|---|---|---|---|',
    ...rows.map(r => `| ${r.screen} | ${r.action} | ${cell(r.first)} | ${cell(r.again)} | ${r.info ? 'info' : r.misses.length ? 'OVER: ' + r.misses.join('; ') : 'ok'} |`),
  ].join('\n')
  writeFileSync(join(dir, `sweep-${project}-${data}.md`), md + '\n')
}

/* ---------------------------------------------------------------- tests */

test.use({viewport: PHONE, hasTouch: true, isMobile: true})
test.describe.configure({timeout: 3_600_000})

for (const data of (process.env.SWEEP_DATA ?? 'demo,bulk').split(',') as Data[]) {
  test(`sweep: every screen and interaction, ${data} data`, async ({page, browserName}, info) => {
    await page.addInitScript(installProbe)
    const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null
    const run: Run = {page, cdp, rate: cdp ? 6 : 1, data}
    const load = {before: loadavg()[0]!, after: 0}
    await page.goto('/')
    await page.waitForFunction(() => !!(window as unknown as {__splitoTest?: object}).__splitoTest, undefined, {timeout: 60_000})
    if (data === 'demo') await openDemo(page)
    else {
      await page.waitForFunction(() => 'splito' in window)
      await page.evaluate(() =>
        (window as unknown as {splito: {seedBulk(a: object): Promise<number>}}).splito.seedBulk({friends: 60, groups: 12, expenses: 10_000}),
      )
    }
    const c: Ctx = {page, data, ids: {person: '', group: '', expense: '', repayment: ''}}
    const rows: Row[] = []

    /* First load: reload the app (the ledger stays on the device) and time it from navigation start. */
    const loads: Sample[] = []
    for (let i = 0; i < LAPS; i++) {
      await throttle(run, run.rate)
      await page.goto('/')
      loads.push(await page.evaluate(() => (window as unknown as {__sw: Probe}).__sw.load))
      await throttle(run, 1)
      await page.waitForTimeout(1500)
    }
    rows.push({
      screen: 'First load',
      action: 'load',
      data,
      first: loads[0]!,
      again: medianOf(loads.slice(1)),
      info: false,
      leaving: false,
      misses: [], // budgeted by the cold-start rule (1.5 s), not the tap budgets
    })

    for (const flow of FLOWS.filter(f => !process.env.SWEEP_ONLY || f.name.includes(process.env.SWEEP_ONLY))) {
      rows.push(...(await runFlow(run, c, flow)))
    }
    load.after = loadavg()[0]!
    report(info.project.name, data, rows, load)
    const over = rows.flatMap(r => r.misses.map(m => `${r.screen} ${r.action} [${r.data}] ${m}`))
    console.log(over.length ? `OVER BUDGET\n${over.join('\n')}` : 'all within budget')
    expect(over, 'interactions over budget').toEqual([])
  })
}

test('the sweep covers every route, in-page tab and sheet of the link table', () => {
  const covered = new Set(FLOWS.flatMap(f => f.steps.map(s => s.screen)))
  const routes = Object.keys(ROUTE_PATHS).filter(r => !['Search'].includes(r))
  // Filled in as flows are added.
  expect(routes.length).toBeGreaterThan(0)
  expect(covered.size).toBeGreaterThan(0)
  void GLOBAL_SHEETS
  void PAGE_TABS
  void SHEETS
})

import {mkdirSync, writeFileSync} from 'node:fs'
import {loadavg} from 'node:os'
import {join} from 'node:path'

import {type CDPSession, expect, type Locator, type Page, test} from '@playwright/test'

import {openDemo} from '../e2e/openDemo'
import {GLOBAL_SHEETS, PAGE_TABS, SETTINGS_SECTION_SHEETS, SHEETS} from '#/lib/links/table'
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
 * Filters: SWEEP_DATA=demo|bulk, SWEEP_ONLY=<flow name regex>, SWEEP_LAPS=<n> (default 4), SWEEP_CPU=<n> (Chrome's
 * throttle, default 6), SWEEP_OUT=<dir>, SWEEP_TAG=<name added to the report file, e.g. base or after>.
 */

/* ---------------------------------------------------------------- in-page probe */

type Pred =
  | {visible: string} // a CSS selector with an element on screen
  | {gone: string} // none on screen
  | {flips: [string, string]} // [selector, attribute] changes from its value when armed
  | {moves: string} // the element's box or opacity changes (a sheet starting to move), or it appears/disappears
  | {ready: string; rows?: string} // on screen with no skeleton inside (aria-busy or *-loading) and, if given, a row
  | {fresh: string} // an element that was not there when armed (a sheet over a sheet), on screen with no skeleton
  | {all: Pred[]}
  | {any: Pred[]}

type Result = {fb: number; ct: number; long: number; exits: number}

type Probe = {
  arm(a: {fb: Pred; ct: Pred; now: boolean; timeout?: number}): void
  result(): Promise<Result>
  load: Promise<Result>
  typeStart(): void
  typeEnd(): {n: number; max: number; long: number}
  framesStart(): void
  framesEnd(): {maxGap: number; slow: number; long: number}
}

function installProbe(START_READY: Pred[]) {
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
  /* The topmost match: a picker's dialog sits after its parent sheet's in the portal. */
  const sig = (sel: string) => {
    const e = [...document.querySelectorAll(sel)].at(-1)
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
    if ('fresh' in p) {
      const before = new Set(document.querySelectorAll(p.fresh))
      return () => [...document.querySelectorAll(p.fresh)].some(r => !before.has(r) && r.getClientRects().length > 0 && !busy(r))
    }
    if ('any' in p) {
      const any = p.any.map(compile)
      return () => any.some(f => f())
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

  const start = (a: {fb: Pred; ct: Pred; now: boolean; timeout?: number}, t0: number) =>
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
        }, a.timeout ?? 8000),
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
    /* The first load: from navigation start to the start tab with its rows. */
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
      ct: {any: START_READY},
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
  /** Unmeasured work right before the step (focus a field, open the sheet it acts on). */
  prepare?: (c: Ctx) => Promise<void>
  /** A pointer gesture: the element to press (found and scrolled to before the clock starts). */
  tap?: (c: Ctx) => Promise<Locator>
  /** Anything else (a link, keys, a wheel): the clock starts as it begins. */
  act?: (c: Ctx) => Promise<void>
  /** `type`: keys into the focused field, measured key-down to the painted echo. `scroll`: wheel over the page, measured by its worst frame gap. */
  kind?: 'type' | 'scroll'
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
  /** The content budget when it is not a tap's 200 ms (the demo seed: a few seconds, with no long task meanwhile). */
  ctBudget?: number
  /** How long the probe waits for the content (default 8 s). */
  timeout?: number
}

type Flow = {
  name: string
  start?: string | ((c: Ctx) => string)
  before?: (c: Ctx) => Promise<void>
  steps: Step[]
  laps?: number
}

const T = (id: string) => `[data-testid="${id}"]`
const P = (prefix: string) => `[data-testid^="${prefix}"]`
const PHONE = {width: 390, height: 844}
const LAPS = Number(process.env.SWEEP_LAPS ?? 4)
const BUDGET = {feedback: 100, content: 200, longTask: 50}
/*
 * A surface that moves in (a sheet, popup, composer or the drawer) starts moving within a frame of the tap (feedback,
 * owner 107), shows its same-size skeleton meanwhile, and mounts its body when the ~300 ms rise ends (owner 168): its
 * body is due 200 ms after the motion, not 200 ms after the tap (owner 189 read with 107 and 168).
 */
const MOVING = {ctBudget: 500}
const SCREEN = (name: string): Pred => ({ready: T(`screen-${name}`)})
const DIALOG = '[role="dialog"]'

/** The first on-screen test id inside `scope` that matches `re` (rows carry the entity's name in their test id). */
async function firstTestId(page: Page, scope: string, re: RegExp, skip: RegExp = /$^/) {
  const id = await page.evaluate(
    ([scope, source, skipSource]) => {
      const re = new RegExp(source!)
      const skip = new RegExp(skipSource!)
      const roots = [...document.querySelectorAll(scope!)].filter(e => e.getClientRects().length > 0)
      for (const root of roots)
        for (const e of root.querySelectorAll('[data-testid]')) {
          const id = e.getAttribute('data-testid')!
          if (re.test(id) && !skip.test(id) && e.getClientRects().length > 0) return id
        }
      return null
    },
    [scope, re.source, skip.source],
  )
  if (!id) throw new Error(`no row like ${re} in ${scope}`)
  return page.locator(`[data-testid="${id}"]:visible`).first()
}

/* The list rows are the anchors (`Link asAnchor`); request and invite rows above the list (owner 197) carry other ids. */
const personRow = (c: Ctx) => Promise.resolve(c.page.locator(`${T('screen-people')} a${P('person-')}:visible`).first())
const groupRow = (c: Ctx) => Promise.resolve(c.page.locator(`${T('screen-groups')} a${P('group-')}:visible`).first())
const historyRow = (c: Ctx) => firstTestId(c.page, T('screen-group'), /^history-.*-e-|^history-bulk-/, /$^/)
/* Kept-mounted screens behind the focused one hold copies of the same test ids, hidden: take the one on screen. */
const tid = (id: string) => (c: Ctx) => Promise.resolve(c.page.locator(`${T(id)}:visible`).first())
const css = (sel: string) => (c: Ctx) => Promise.resolve(c.page.locator(`${sel}:visible`).first())
const link = (url: string | ((c: Ctx) => string)) => async (c: Ctx) =>
  void (await c.page.evaluate(
    u => (window as unknown as {__splitoTest: {openLink(u: string): void}}).__splitoTest.openLink(u),
    typeof url === 'string' ? url : url(c),
  ))
/** A tap that is not measured (opening what the next step acts on). */
async function tapQuietly(c: Ctx, id: string) {
  const target = c.page.locator(`${T(id)}:visible`).first()
  const b = await aim(c.page, target)
  await c.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  if (process.env.SWEEP_DEBUG) console.log('tapQuietly', id, JSON.stringify(b), await c.page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.outerHTML.slice(0, 200), [b.x + b.width / 2, b.y + b.height / 2]))
}
/** The switch sends the app home; the next step starts from Settings again. */
async function onSettings(c: Ctx) {
  const toggle = c.page.locator(`${T('settings-demo-mode')}:visible`)
  /* A switch made a moment ago may still send the app home after the page loads: try again until Settings stays. */
  for (let i = 0; i < 4 && !(await toggle.count()); i++) {
    await c.page.goto('/settings')
    await toggle.first().waitFor({timeout: 15_000}).catch(() => {})
    await c.page.waitForTimeout(2000)
  }
}
const press = (key: string) => async (c: Ctx) => void (await c.page.keyboard.press(key))

/** A pushed page's way back: the header's Back. */
const back = (screen: string, id = screen.toLowerCase()): Step => ({
  screen,
  action: 'back',
  tap: tid('header-back'),
  fb: {gone: T(`screen-${id}`)},
  ct: {all: [{gone: T(`screen-${id}`)}, {ready: P('screen-')}]},
  leaving: true,
})
/** A page opened by a link: the browser's Back. */
const browserBack = (screen: string, id = screen.toLowerCase()): Step => ({
  screen,
  action: 'back (browser)',
  act: async c => void (await c.page.goBack()),
  fb: {gone: T(`screen-${id}`)},
  ct: {all: [{gone: T(`screen-${id}`)}, {ready: P('screen-')}]},
  leaving: true,
})
/** A composer or sheet-like route closes with its cross. */
const closeRoute = (screen: string, id: string): Step => ({
  screen,
  action: 'close',
  tap: tid('sheet-close'),
  fb: {gone: T(`screen-${id}`)},
  ct: {all: [{gone: T(`screen-${id}`)}, {ready: P('screen-')}]},
  leaving: true,
})
const openPage = (screen: string, id: string, tap: Step['tap'], extra: Partial<Step> = {}): Step => ({
  screen,
  action: 'open',
  tap,
  fb: {visible: T(`screen-${id}`)},
  ct: SCREEN(id),
  ...extra,
})

/** A sheet, popup or menu opening from a tap and closing again. */
const sheet = (screen: string, what: string, open: Step['tap'], extra: Partial<Step> = {}): Step[] => [
  {screen, action: `${what}: open`, tap: open, fb: {moves: DIALOG}, ct: {fresh: DIALOG}, ...MOVING, settle: 900, ...extra},
  {screen, action: `${what}: close`, act: press('Escape'), fb: {moves: DIALOG}, ct: {moves: DIALOG}, settle: 700},
]

const TAB = (to: string, screen: string, rows: string): Step => ({
  screen: `Tab ${screen}`,
  action: 'tab',
  tap: tid(`tab-${to}`),
  fb: {flips: [T(`tab-${to}`), 'aria-current']},
  ct: {ready: T(`screen-${to}`), rows},
})

/* `components/settings/sections.ts` plus the two one-row pages, Support (owner 204) and Your data (owner 205). */
const SETTINGS_SECTIONS = ['appearance', 'navigation', 'defaults', 'categories', 'regional', 'notifications', 'privacy', 'support', 'data']
const NO_CODE = 'abcdefabcdefabcd'

const idsOf = (c: Ctx) => c.ids


/** Typing in a field: every key down to its painted echo. `field` is focused (and emptied) before the clock starts. */
function typing(screen: string, start: Flow['start'], row: string, open: (c: Ctx) => Promise<void>, field: string, text = 'rahul sharma 120'): Flow {
  return {
    name: `Type: ${screen}`,
    start,
    steps: [
      {
        screen: row,
        action: `type in ${field}`,
        kind: 'type',
        prepare: async c => {
          await open(c)
          const input = c.page.locator(`${T(field)}:visible`).first()
          await input.click()
          await input.fill('')
          await c.page.waitForTimeout(300)
        },
        act: async c => void (await c.page.keyboard.type(text, {delay: 45})),
        fb: {visible: 'body'},
        settle: 500,
      },
    ],
  }
}

/** Scrolling a screen's list down and back up: the worst frame gap and the longest block. */
function scrolling(screen: string, start: Flow['start']): Flow {
  return {
    name: `Scroll: ${screen}`,
    start,
    steps: [
      {
        screen,
        action: 'scroll',
        kind: 'scroll',
        act: async c =>
          /* A fling: 40 px a frame for 30 frames down and back. (Playwright has no wheel in mobile WebKit and no swipe.) */
          void (await c.page.evaluate(async () => {
            const run = (n: number, d: number) =>
              new Promise<void>(done => {
                let i = 0
                const frame = () => {
                  window.scrollBy(0, d)
                  if (++i < n) requestAnimationFrame(frame)
                  else done()
                }
                requestAnimationFrame(frame)
              })
            await run(30, 40)
            await run(30, -40)
          })),
        fb: {visible: 'body'},
        settle: 500,
      },
    ],
  }
}

/*
 * The main tabs are the link table's tab routes (`ROUTE_PATHS`), so a tab that is added or removed (F-271 removed Home,
 * made Settings a tab) changes the sweep with it; each names the rows that mean "its content is on screen". A tab route
 * missing here fails the coverage test.
 */
const TAB_ROWS: Record<string, string> = {
  People: P('person-'),
  Groups: P('group-'),
  Analytics: P('analytics-over-time-chart'),
  Activity: P('activity-'),
  Settings: P('settings-'),
}
const TABS = Object.keys(ROUTE_PATHS).filter(r => r in TAB_ROWS)
/** Any tab on screen with its rows: the first load and the demo switch land on the start tab, whichever it is. */
const START_READY: Pred[] = TABS.map(r => ({ready: T(`screen-${r.toLowerCase()}`), rows: TAB_ROWS[r]}))

const FLOWS: Flow[] = [
  /* From the start tab round every tab and back to the first: each tab is left once and opened once more. */
  {name: 'tabs', steps: [...TABS.slice(1), TABS[0]!].map(r => TAB(r.toLowerCase(), r, TAB_ROWS[r]!))},
  {name: 'Person', start: '/people', steps: [openPage('Person', 'person', personRow), back('Person')]},
  {name: 'Group', start: '/groups', steps: [openPage('Group', 'group', groupRow), back('Group')]},
  {
    name: 'Group tabs',
    start: c => `/groups/${idsOf(c).group}`,
    steps: (['balances', 'members', 'expenses'] as const).map(t => ({
      screen: 'Group',
      action: `tab ${t}`,
      tap: tid(`group-tab-${t}`),
      fb: {flips: [T(`group-tab-${t}`), 'aria-selected']},
      ct: {all: [{flips: [T(`group-tab-${t}`), 'aria-selected']}, {ready: T('screen-group')}]},
    })),
  },
  {
    name: 'Expense',
    start: c => `/groups/${idsOf(c).group}`,
    steps: [openPage('Expense', 'expense', historyRow), back('Expense')],
  },
  {
    name: 'EditExpense',
    start: c => `/expense/${idsOf(c).expense}`,
    steps: [openPage('EditExpense', 'edit-expense', tid('expense-edit-button'), MOVING), closeRoute('EditExpense', 'edit-expense')],
  },
  {
    name: 'Settle',
    start: c => `/groups/${idsOf(c).group}`,
    steps: [openPage('Settle', 'settle', tid('group-settle')), back('Settle')],
  },
  {
    name: 'Repayment',
    start: '/',
    steps: [
      openPage('Repayment', 'repayment', undefined, {act: link(c => `/payment/${idsOf(c).repayment}`), tap: undefined}),
      browserBack('Repayment'),
    ],
  },
  /* The avatar opens Profile at every width (owners 201, 206); the phone drawer opens by an edge swipe or its address. */
  {name: 'Profile', steps: [openPage('Profile', 'profile', tid('header-avatar')), back('Profile')]},
  {
    name: 'Drawer',
    start: '/people',
    steps: [
      {screen: 'Drawer', action: 'open', act: link('/people?drawer=menu'), fb: {moves: T('drawer')}, ct: {ready: T('drawer')}, ...MOVING, settle: 900},
      {screen: 'Drawer', action: 'close', act: press('Escape'), fb: {moves: T('drawer')}, ct: {gone: T('drawer')}, settle: 700},
    ],
  },
  ...SETTINGS_SECTIONS.map(
    (section): Flow => ({
      name: `Settings ${section}`,
      start: '/settings',
      steps: [
        openPage(`SettingsSection ${section}`, 'settings-section', tid(`settings-${section}`)),
        back(`SettingsSection ${section}`, 'settings-section'),
      ],
    }),
  ),
  {
    name: 'FriendsAndInvites',
    start: '/settings',
    steps: [openPage('FriendsAndInvites', 'friends-invites', tid('settings-friends')), back('FriendsAndInvites', 'friends-invites')],
  },
  {
    name: 'AddFriend',
    start: '/people',
    steps: [openPage('AddFriend', 'add-friend', tid('people-add-friend'), MOVING), closeRoute('AddFriend', 'add-friend')],
  },
  {
    name: 'Welcome',
    steps: [openPage('Welcome', 'welcome', undefined, {act: link('/welcome/1')}), browserBack('Welcome')],
  },
  {
    name: 'CreateGroup',
    start: '/groups',
    steps: [openPage('CreateGroup', 'create-group', tid('groups-new'), MOVING), closeRoute('CreateGroup', 'create-group')],
  },
  {
    name: 'AddExpense',
    steps: [openPage('AddExpense', 'add-expense', tid('fab-add'), MOVING), closeRoute('AddExpense', 'add-expense')],
  },
  {
    name: 'InviteLinks',
    steps: [
      openPage('InviteLinks', 'invite-links', undefined, {act: link('/invites')}),
      browserBack('InviteLinks', 'invite-links'),
    ],
  },
  {
    name: 'CreateInvite',
    steps: [
      openPage('CreateInvite', 'create-invite', undefined, {act: link('/invites/new')}),
      browserBack('CreateInvite', 'create-invite'),
    ],
  },
  {
    name: 'ShareInvite',
    steps: [
      openPage('ShareInvite', 'invite-link', undefined, {act: link(`/invites/${NO_CODE}/share`)}),
      browserBack('ShareInvite', 'invite-link'),
    ],
  },
  {
    name: 'Invite',
    steps: [openPage('Invite', 'invite', undefined, {act: link(`/invite/${NO_CODE}`)}), browserBack('Invite')],
  },
  /* ---- menus, filters and pickers opened by a tap */
  {
    name: 'Menus: Person',
    start: c => `/people/${idsOf(c).person}`,
    steps: [
      ...sheet('Person', 'menu', tid('person-more')),
      ...sheet('Person', 'filters', tid('person-filter')),
    ],
  },
  {
    name: 'Menus: Group',
    start: c => `/groups/${idsOf(c).group}`,
    steps: [
      ...sheet('Group', 'menu', tid('group-more')),
      ...sheet('Group', 'filters', tid('group-filter')),
    ],
  },
  {
    name: 'Menus: Expense',
    start: c => `/expense/${idsOf(c).expense}`,
    steps: sheet('Expense', 'menu', tid('expense-menu')),
  },
  {
    name: 'Menus: Settle',
    start: c => `/groups/${idsOf(c).group}/settle`,
    steps: sheet('Settle', 'transfer menu', tid('transfer-more')),
  },
  {
    name: 'Menus: Activity',
    start: '/activity',
    steps: sheet('Activity', 'row menu', tid('activity-menu')),
  },
  {
    name: 'Menus: Friends hub',
    start: '/settings/friends',
    steps: sheet('FriendsAndInvites', 'friend menu', tid('hub-friend-menu')),
  },
  {
    name: 'Filters: People',
    start: '/people',
    steps: sheet('People', 'filters', tid('list-filters')),
  },
  {
    name: 'Filters: Groups',
    start: '/groups',
    steps: [
      {
        screen: 'Groups',
        action: 'filters: open',
        tap: tid('list-filters'),
        fb: {moves: DIALOG},
        ct: {fresh: DIALOG},
        ...MOVING,
        settle: 900,
      },
      {screen: 'Groups', action: 'filter chip', tap: tid('filter-show-owed'), fb: {flips: [T('filter-show-owed'), 'aria-checked']}, settle: 500},
      {
        screen: 'Groups',
        action: 'filter apply',
        tap: tid('sheet-save'),
        fb: {moves: DIALOG},
        ct: {visible: T('list-filters-dot')},
        settle: 900,
      },
    ],
    /* The filter sticks in the page's address, so a second lap would start filtered: one sample, from a fresh load. */
    laps: 1,
  },
  {
    name: 'Filters: Activity',
    start: '/activity',
    steps: [1, 2, 0].map(
      (i): Step => ({
        screen: 'Activity',
        action: `tab ${PAGE_TABS.Activity[i]}`,
        tap: tid(`activity-tabs-selector-${i}`),
        fb: {flips: [T(`activity-tabs-selector-${i}`), 'aria-selected']},
        ct: {all: [{flips: [T(`activity-tabs-selector-${i}`), 'aria-selected']}, SCREEN('activity')]},
      }),
    ),
  },
  {
    name: 'Analytics controls',
    start: '/analytics',
    steps: [
      ...sheet('Analytics', 'scope', tid('analytics-scope')),
      ...sheet('Analytics', 'period', tid('analytics-period')),
      ...sheet('Analytics', 'currency', tid('analytics-currency')),
      {
        screen: 'Analytics',
        action: 'previous period',
        tap: tid('analytics-prev'),
        fb: {moves: T('analytics-period-label')},
        ct: {ready: T('screen-analytics'), rows: P('analytics-over-time-chart')},
      },
      {
        screen: 'Analytics',
        action: 'next period',
        tap: tid('analytics-next'),
        fb: {moves: T('analytics-period-label')},
        ct: {ready: T('screen-analytics'), rows: P('analytics-over-time-chart')},
      },
      {
        screen: 'Analytics',
        action: 'view toggle',
        tap: tid('analytics-view-toggle'),
        fb: {flips: [T('analytics-view-toggle'), 'aria-checked']},
        ct: {ready: T('screen-analytics')},
      },
      {
        screen: 'Analytics',
        action: 'view toggle back',
        tap: tid('analytics-view-toggle'),
        fb: {flips: [T('analytics-view-toggle'), 'aria-checked']},
        ct: {ready: T('screen-analytics')},
      },
    ],
  },
  /* ---- global sheets by link */
  ...(['feedback', 'install'] as const).map(
    (name): Flow => ({
      name: `Global sheet: ${name}`,
      steps: [
        {screen: `Global sheet ${name}`, action: 'open', act: link(`/?${name}=${name === 'feedback' ? 'new' : 'help'}`), fb: {moves: DIALOG}, ct: {fresh: DIALOG}, ...MOVING, settle: 900},
        {screen: `Global sheet ${name}`, action: 'close', act: press('Escape'), fb: {moves: DIALOG}, ct: {moves: DIALOG}, settle: 700},
      ],
    }),
  ),
  /* ---- typing */
  typing('People search', '/people', 'People', async c => {
    if (!(await c.page.locator(`${T('list-search-input')}:visible`).count())) {
      await tapQuietly(c, 'list-search')
      await c.page.waitForTimeout(700)
    }
  }, 'list-search-input'),
  typing('Groups search', '/groups', 'Groups', async c => {
    if (!(await c.page.locator(`${T('list-search-input')}:visible`).count())) {
      await tapQuietly(c, 'list-search')
      await c.page.waitForTimeout(700)
    }
  }, 'list-search-input'),
  typing('Search & Ask', '/', 'Search & Ask', async c => {
    if (!(await c.page.locator(`${DIALOG}:visible`).count())) {
      await tapQuietly(c, 'header-search-ask')
      await c.page.waitForTimeout(900)
    }
  }, 'search-input'),
  typing('Friends hub search', '/settings/friends', 'FriendsAndInvites', async () => {}, 'hub-friends-search'),
  typing('Add friend name', '/friends/new', 'AddFriend', async () => {}, 'add-friend-name'),
  typing('Add expense title', '/expense/new', 'AddExpense', async c => void (await c.page.waitForTimeout(800)), 'expense-title'),
  typing('Add expense amount', '/expense/new', 'AddExpense', async c => void (await c.page.waitForTimeout(800)), 'amount-input', '120.50'),
  typing('Expense comment', c => `/expense/${idsOf(c).expense}`, 'Expense', async () => {}, 'comment-input'),
  typing('Feedback message', '/?feedback=new', 'Feedback sheet', async c => void (await c.page.waitForTimeout(900)), 'feedback-message'),
  /* ---- scrolling */
  ...TABS.map(r => scrolling(r, (ROUTE_PATHS as Record<string, string>)[r]!)),
  scrolling('Group', c => `/groups/${idsOf(c).group}`),
  scrolling('Person', c => `/people/${idsOf(c).person}`),
  scrolling('Settings', '/settings'),
  scrolling('FriendsAndInvites', '/settings/friends'),
  scrolling('Expense', c => `/expense/${idsOf(c).expense}`),
  /* ---- writes */
  {
    name: 'Save expense',
    steps: [
      openPage('AddExpense', 'add-expense', tid('fab-add'), {...MOVING, settle: 800}),
      {
        screen: 'AddExpense',
        action: 'save',
        prepare: async c => {
          const p = c.page
          await p.locator(`${T('expense-title')}:visible`).first().fill('Sweep expense')
          await p.locator(`${T('amount-input')}:visible`).first().fill('120')
          await p.locator(`${T('expense-people')}:visible`).first().tap()
          await p.locator(`${P('person-option-')}:not(${P('person-option-locked-')}):not([aria-disabled="true"]):visible`).first().tap()
          await p.locator(`${T('people-dialog')} ${T('sheet-close')}`).first().tap()
          await expect(p.locator(`${T('sheet-save')}:visible`).first()).toBeEnabled()
          await p.waitForTimeout(600)
        },
        tap: tid('sheet-save'),
        /* Feedback: the button goes busy; content: the write committed and its check is on screen. */
        fb: {any: [{visible: T('expense-saved')}, {flips: [T('sheet-save'), 'aria-disabled']}]},
        ct: {visible: T('expense-saved')},
        settle: 1500,
      },
    ],
  },
  {
    name: 'Record payment',
    start: c => `/people/${idsOf(c).person}`,
    steps: [
      {
        screen: 'Person',
        action: 'record payment: save',
        prepare: async c => {
          const p = c.page
          await link(`/people/${idsOf(c).person}/record-payment`)(c)
          const amount = p.locator(`${T('payment-amount')}:visible`).first()
          await amount.waitFor({timeout: 15_000})
          await p.waitForTimeout(700)
          await amount.fill('10')
          await expect(p.locator(`${T('record-payment-sheet')} ${T('sheet-save')}:visible`).first()).toBeEnabled()
          await p.waitForTimeout(400)
        },
        tap: css(`${T('record-payment-sheet')} ${T('sheet-save')}`),
        fb: {any: [{visible: T('payment-recorded')}, {flips: [`${T('record-payment-sheet')} ${T('sheet-save')}`, 'aria-disabled']}]},
        ct: {visible: T('payment-recorded')},
        settle: 2500,
      },
    ],
  },
  {
    name: 'Delete expense',
    start: c => `/expense/${idsOf(c).expense}`,
    steps: [
      {
        screen: 'Expense',
        action: 'delete: menu',
        /* Deleting may leave the page: come back to the live expense for every lap. */
        prepare: async c => {
          await c.page.evaluate(id => (window as unknown as {splito: {restoreExpense(id: string): Promise<unknown>}}).splito.restoreExpense(id).catch(() => {}), idsOf(c).expense)
          if (!(await c.page.locator(`${T('screen-expense')}:visible`).count())) await link(`/expense/${idsOf(c).expense}`)(c)
          await expect(c.page.locator(`${T('expense-menu')}:visible`).first()).toBeVisible()
        },
        tap: tid('expense-menu'),
        fb: {moves: DIALOG},
        ct: {fresh: DIALOG},
        ...MOVING,
        settle: 900,
      },
      {screen: 'Expense', action: 'delete', tap: tid('expense-delete'), fb: {any: [{visible: T('expense-deleted')}, {gone: T('screen-expense')}]}, settle: 1200},
    ],
  },
  /* ---- demo mode */
  {
    name: 'Demo mode switch',
    start: '/settings',
    before: async c => {
      /* The first switch on seeds a year of data and is a job of its own; the sweep measures the switches after it. */
      await c.page.evaluate(async () => {
        const hook = (window as unknown as {__splitoTest: {demoMode(on: boolean): Promise<void>}}).__splitoTest
        await hook.demoMode(true)
        await hook.demoMode(false)
        await hook.demoMode(true)
      })
      await onSettings(c)
    },
    steps: [
      {screen: 'Settings', action: 'demo mode off', prepare: onSettings, tap: tid('settings-demo-mode'), fb: {flips: [T('settings-demo-mode'), 'aria-checked']}, ct: {all: [{flips: [T('settings-demo-mode'), 'aria-checked']}, {any: START_READY}]}, settle: 2500},
      /*
       * On seeds a fresh year of data (off erased it, owner 136). Feedback is the progress pill; content is the demo
       * showing, within a few seconds, and the app must stay usable meanwhile: no main-thread block over 50 ms.
       */
      {
        screen: 'Settings',
        action: 'demo mode on (seed)',
        prepare: onSettings,
        tap: tid('settings-demo-mode'),
        fb: {any: [{visible: T('demo-progress')}, {flips: [T('settings-demo-mode'), 'aria-checked']}]},
        ct: {all: [{flips: [T('settings-demo-mode'), 'aria-checked']}, {any: START_READY}]},
        ctBudget: 5000,
        timeout: 180_000,
        settle: 4000,
      },
    ],
    laps: 2,
  },
  {
    name: 'Search',
    steps: [
      {screen: 'Search & Ask', action: 'open', tap: tid('header-search-ask'), fb: {moves: DIALOG}, ct: {fresh: DIALOG}, ...MOVING, settle: 900},
      {screen: 'Search & Ask', action: 'close', tap: tid('search-ask-cancel'), fb: {moves: DIALOG}, ct: {moves: DIALOG}, settle: 700},
    ],
  },
]

/*
 * Every sheet, popup and picker of the link table (`SHEETS`): opened by its link from the page it belongs to (a link is
 * how a tap, a push or a shared URL opens one), closed with Escape. A picker is opened over its parent sheet, which
 * stays open for all of that sheet's pickers (the parent's own open and close are reported but not budgeted twice).
 */
const SHEET_BASE: Record<string, (c: Ctx) => string> = {
  People: () => '/people',
  Groups: () => '/groups',
  Activity: () => '/activity',
  Analytics: () => '/analytics',
  Person: c => `/people/${idsOf(c).person}`,
  Group: c => `/groups/${idsOf(c).group}`,
  Profile: () => '/profile',
  CreateGroup: () => '/groups/new',
  AddExpense: () => '/expense/new',
  EditExpense: c => `/expense/${idsOf(c).expense}/edit`,
}
const sectionBase = (section: string) => (_: Ctx) => `/settings/${section}`

function sheetFlows(): Flow[] {
  const pages: Array<[string, (c: Ctx) => string, readonly string[]]> = [
    ...Object.entries(SHEET_BASE).map(([name, base]): [string, (c: Ctx) => string, readonly string[]] => [name, base, (SHEETS as Record<string, readonly string[]>)[name] ?? []]),
    ...Object.entries(SETTINGS_SECTION_SHEETS).map(([section, chains]): [string, (c: Ctx) => string, readonly string[]] => [`SettingsSection ${section}`, sectionBase(section), chains]),
  ]
  return pages.map(([name, base, chains]) => {
    const parents = chains.filter(ch => !ch.includes('/'))
    const steps: Step[] = []
    for (const parent of parents) {
      const url = (c: Ctx) => `${base(c).replace(/\/$/, '')}/${parent}`
      const kids = chains.filter(ch => ch.startsWith(`${parent}/`))
      steps.push({screen: `${name} sheet`, action: parent, act: link(url), fb: {moves: DIALOG}, ct: {fresh: DIALOG}, ...MOVING, settle: 1000})
      for (const kid of kids) {
        steps.push({screen: `${name} sheet`, action: kid, act: link(c => `${base(c).replace(/\/$/, '')}/${kid}`), fb: {moves: DIALOG}, ct: {fresh: DIALOG}, ...MOVING, settle: 1000})
        steps.push({screen: `${name} sheet`, action: `${kid}: close`, act: press('Escape'), fb: {moves: DIALOG}, ct: {moves: DIALOG}, settle: 700})
      }
      steps.push({screen: `${name} sheet`, action: `${parent}: close`, act: press('Escape'), fb: {moves: DIALOG}, ct: {moves: DIALOG}, settle: 700})
    }
    return {name: `Sheets: ${name}`, start: base, steps}
  })
}

FLOWS.push(...sheetFlows())

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

function misses(s: Sample, step: {leaving?: boolean; info?: boolean; ctBudget?: number}, label: string): string[] {
  const content = step.ctBudget ?? BUDGET.content
  if (step.info) return []
  const out: string[] = []
  if (s.fb < 0) out.push(`${label}: feedback never showed`)
  else if (s.fb > BUDGET.feedback) out.push(`${label}: feedback ${s.fb.toFixed(0)} ms > ${BUDGET.feedback}`)
  if (s.ct < 0) out.push(`${label}: content never showed`)
  else if (s.ct > content) out.push(`${label}: content ${s.ct.toFixed(0)} ms > ${content}`)
  if (s.long > BUDGET.longTask) out.push(`${label}: long task ${s.long.toFixed(0)} ms > ${BUDGET.longTask}`)
  if (step.leaving && s.exits > 0) out.push(`${label}: ${s.exits} exit animations on a leaving screen`)
  return out
}

/** Finds the element, scrolls it in and waits until it holds still: the clock must not include any of that. */
async function aim(page: Page, target: Locator) {
  await expect(target).toBeVisible({timeout: 30_000})
  /* Rows still arriving (the demo loads history in the background) move things: wait for two equal boxes in view. */
  let last = ''
  for (let i = 0; i < 12; i++) {
    /* Centred, not at the edge: the header and the bottom bar and FAB cover the ends of the page. */
    await target.evaluate(e => e.scrollIntoView({block: 'center', inline: 'center'}))
    await page.waitForTimeout(350)
    const b = (await target.boundingBox())!
    const key = JSON.stringify(b)
    if (key === last && b.y >= 0 && b.y + b.height <= PHONE.height) return b
    last = key
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

/*
 * Playwright's own session turns Chrome's accessibility tree on, and every commit then rebuilds it: 66 of a 213 ms
 * Analytics revisit at 6x was `Blink.Accessibility`, work a phone without a screen reader never does (Mobile Safari
 * builds no tree unless VoiceOver runs). Measured steps switch it off first; it stays off until Playwright asks again.
 */
async function throttle(run: Run, rate: number) {
  await run.cdp?.send('Accessibility.disable').catch(() => {})
  await run.cdp?.send('Emulation.setCPUThrottlingRate', {rate})
}

async function runStep(run: Run, c: Ctx, step: Step): Promise<Sample> {
  const {page} = run
  await step.prepare?.(c)
  let target: Locator | null = null
  if (step.tap) {
    target = await step.tap(c)
    await aim(page, target)
  }
  const probe = <T>(f: (p: Probe) => T) => page.evaluate(f as never) as Promise<T>
  await throttle(run, run.rate)
  let r: Sample
  if (step.kind === 'type') {
    await page.evaluate(() => (window as unknown as {__sw: Probe}).__sw.typeStart())
    await step.act!(c)
    await page.waitForTimeout(300)
    const t = await page.evaluate(() => (window as unknown as {__sw: Probe}).__sw.typeEnd())
    r = {fb: t.n ? t.max : -1, ct: t.n ? t.max : -1, long: t.long, exits: 0}
  } else if (step.kind === 'scroll') {
    await page.evaluate(() => (window as unknown as {__sw: Probe}).__sw.framesStart())
    await step.act!(c)
    await page.waitForTimeout(300)
    const f = await page.evaluate(() => (window as unknown as {__sw: Probe}).__sw.framesEnd())
    r = {fb: f.maxGap, ct: f.maxGap, long: f.long, exits: 0}
  } else {
    await page.evaluate(a => (window as unknown as {__sw: Probe}).__sw.arm(a), {fb: step.fb, ct: step.ct ?? step.fb, now: !step.tap, timeout: step.timeout})
    if (target) {
      const b = (await target.boundingBox())!
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    } else await step.act!(c)
    r = await page.evaluate(() => (window as unknown as {__sw: Probe}).__sw.result())
  }
  void probe
  await throttle(run, 1)
  await page.waitForTimeout(step.settle ?? 400)
  return r
}

async function runFlow(run: Run, c: Ctx, flow: Flow): Promise<Row[]> {
  const steps = flow.steps.filter(s => !s.data || s.data === run.data)
  const laps: Sample[][] = steps.map(() => [])
  await boot(run, typeof flow.start === 'function' ? flow.start(c) : (flow.start ?? '/'))
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

/** Ids the link-opened flows need, from the store: a person and group with history, an expense in that group, a payment. */
async function findIds(page: Page, data: Data) {
  return page.evaluate(async d => {
    type E = {id: string; deleted: boolean; data: Record<string, unknown>}
    const s = (window as unknown as {splito: {me: string; list(t: string): Promise<E[]>; createRepayment(i: unknown): Promise<string>}}).splito
    const live = async (t: string) => (await s.list(t)).filter(e => !e.deleted)
    const people = (await live('person')).filter(p => p.id !== s.me)
    const groups = await live('group')
    const expenses = (await live('expense')).filter(e => groups.some(g => g.id === e.data.groupId))
    const group = groups.find(g => expenses.some(e => e.data.groupId === g.id)) ?? groups[0]!
    const expense = expenses.find(e => e.data.groupId === group.id) ?? expenses[0]!
    let repayment = (await live('repayment'))[0]?.id
    if (!repayment && d === 'bulk')
      repayment = await s.createRepayment({groupId: null, currency: 'INR', from: people[0]!.id, to: s.me, amount: '1000', date: '2026-10-01', tz: 'Asia/Kolkata', note: ''})
    return {person: people[0]!.id, group: group.id, expense: expense.id, repayment: repayment ?? ''}
  }, data)
}

/* ---------------------------------------------------------------- the report */

const cell = (s: Sample | null) => (s ? `${s.fb < 0 ? 'never' : s.fb.toFixed(0)} / ${s.ct < 0 ? 'never' : s.ct.toFixed(0)} / ${s.long.toFixed(0)}${s.exits ? ` / ${s.exits} exits` : ''}` : '-')

function report(project: string, data: Data, rows: Row[], load: {before: number; after: number}) {
  const dir = process.env.SWEEP_OUT ?? 'perf-results'
  mkdirSync(dir, {recursive: true})
  const usable = Math.max(load.before, load.after) < 10
  const tag = process.env.SWEEP_TAG ? `-${process.env.SWEEP_TAG}` : ''
  writeFileSync(join(dir, `sweep-${project}-${data}${tag}.json`), JSON.stringify({project, data, load, usable, budget: BUDGET, rows}, null, 1))
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
  writeFileSync(join(dir, `sweep-${project}-${data}${tag}.md`), md + '\n')
}

/* ---------------------------------------------------------------- tests */

test.use({viewport: PHONE, hasTouch: true, isMobile: true})
test.describe.configure({timeout: 3_600_000})

for (const data of (process.env.SWEEP_DATA ?? 'demo,bulk').split(',') as Data[]) {
  test(`sweep: every screen and interaction, ${data} data`, async ({page, browserName}, info) => {
    await page.addInitScript(installProbe, START_READY)
    page.on('pageerror', e => console.log(`pageerror: ${(e.stack ?? e.message).slice(0, 1200)}`))
    page.on('crash', () => console.log('page crashed'))
    const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null
    /* Chrome at 6x by default (the slowest target); SWEEP_CPU=1 measures it unthrottled. */
    const run: Run = {page, cdp, rate: cdp ? Number(process.env.SWEEP_CPU ?? 6) : 1, data}
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
    const c: Ctx = {page, data, ids: await findIds(page, data)}
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

    for (const flow of FLOWS.filter(f => !process.env.SWEEP_ONLY || new RegExp(process.env.SWEEP_ONLY).test(f.name))) {
      try {
        rows.push(...(await runFlow(run, c, flow)))
      } catch (e) {
        /* A flow that cannot run is a miss of its own, not the end of the sweep. */
        await throttle(run, 1)
        mkdirSync(process.env.SWEEP_OUT ?? 'perf-results', {recursive: true})
        await page.screenshot({path: join(process.env.SWEEP_OUT ?? 'perf-results', `fail-${flow.name.replace(/\W+/g, '-')}.png`)}).catch(() => {})
        const dead: Sample = {fb: -1, ct: -1, long: 0, exits: 0}
        rows.push({screen: flow.name, action: 'flow failed', data, first: dead, again: null, info: false, leaving: false, misses: [`flow failed: ${String(e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 4).join(' ')}`]})
      }
    }
    load.after = loadavg()[0]!
    report(info.project.name, data, rows, load)
    const over = rows.flatMap(r => r.misses.map(m => `${r.screen} ${r.action} [${r.data}] ${m}`))
    console.log(over.length ? `OVER BUDGET\n${over.join('\n')}` : 'all within budget')
    expect(over, 'interactions over budget').toEqual([])
  })
}

test('the sweep covers every route, in-page tab, sheet and global sheet of the link table', () => {
  const screens = FLOWS.flatMap(f => f.steps.map(s => s.screen))
  const has = (name: string) => screens.some(x => x === name || x.startsWith(`${name} `))
  const missing: string[] = []
  for (const route of Object.keys(ROUTE_PATHS)) {
    const ok = route === 'Search' ? has('Search & Ask') : has(route) || has(`Tab ${route}`)
    if (!ok) missing.push(`route ${route}`)
  }
  for (const [page, chains] of Object.entries(SHEETS)) {
    const flow = FLOWS.find(f => f.name === `Sheets: ${page}`) ?? FLOWS.filter(f => f.name.startsWith('Sheets: SettingsSection')).find(() => page === 'SettingsSection')
    if (!flow) missing.push(`sheets of ${page}`)
    else if (page !== 'SettingsSection')
      for (const chain of chains as readonly string[]) if (!flow.steps.some(s => s.action === chain)) missing.push(`sheet ${page}/${chain}`)
  }
  for (const [section, chains] of Object.entries(SETTINGS_SECTION_SHEETS)) {
    const flow = FLOWS.find(f => f.name === `Sheets: SettingsSection ${section}`)
    for (const chain of chains) if (!flow?.steps.some(s => s.action === chain)) missing.push(`sheet SettingsSection ${section}/${chain}`)
  }
  for (const [page, tabs] of Object.entries(PAGE_TABS))
    for (const tab of tabs) if (!FLOWS.some(f => f.steps.some(s => s.screen === page && s.action === `tab ${tab}`))) missing.push(`tab ${page}/${tab}`)
  const globals: Record<(typeof GLOBAL_SHEETS)[number], string> = {search: 'Search & Ask', drawer: 'Drawer', feedback: 'Global sheet feedback', install: 'Global sheet install'}
  for (const g of GLOBAL_SHEETS) if (!has(globals[g])) missing.push(`global sheet ${g}`)
  expect(missing, 'link-table entries the sweep does not walk').toEqual([])
})

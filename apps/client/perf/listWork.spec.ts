import {loadavg} from 'node:os'

import {type CDPSession, expect, type Page, test} from '@playwright/test'

import {openDemo} from '../e2e/openDemo'

/*
 * Work per keystroke in the People list search and per fling on Activity (ARCHITECTURE 17.1, F-266 sweep misses), on the
 * large demo at 390 px with touch. What is gated is structural, so it holds at any machine load: the React renders a
 * keystroke or a fling causes (counted from the commit hook, as the renders gate does, in the e2e build), the person
 * rows mounted, re-rendered or cloned out by a key, and the activity rows one task mounts. Timings (worst key-to-echo,
 * longest task, worst frame gap at CPU x6) are printed with the machine load and count only under load 10.
 *
 * Run (after `pnpm e2e:build`): `E2E_PORT=8931 pnpm perf listWork`. LISTWORK_CPU sets Chrome's throttle (default 6).
 */

type Counts = Record<string, number>
type Win = {
  __lw: {
    counts: Counts
    names: Counts
    commits: number
    long: number[]
    reset(): void
  }
}

function instrument() {
  const state = {
    counts: {} as Record<string, number>,
    names: {} as Record<string, number>,
    commits: 0,
    long: [] as number[],
    reset() {
      state.counts = {}
      state.names = {}
      state.commits = 0
      state.long = []
    },
  }
  ;(window as unknown as Win).__lw = state
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) state.long.push(e.duration)
  }).observe({type: 'longtask', buffered: false})
  type FiberType = {displayName?: string; name?: string; type?: FiberType; render?: FiberType}
  type Fiber = {
    tag: number
    flags: number
    type: FiberType | null
    child: Fiber | null
    sibling: Fiber | null
    alternate: Fiber | null
    memoizedProps?: {testID?: string; 'data-testid'?: string} | null
  }
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15])
  /* Rows of each kind this commit mounted; the most any one commit mounted is kept as `max:<kind>`. */
  let perCommit: Record<string, number> = {}
  const walk = (first: Fiber | null) => {
    for (let fiber = first; fiber; fiber = fiber.sibling) {
      if (COMPONENT_TAGS.has(fiber.tag) && (!fiber.alternate || (fiber.flags & 1) === 1)) {
        const n = fiber.alternate ? 'update' : 'mount'
        state.counts[n] = (state.counts[n] ?? 0) + 1
        const t = fiber.type
        const fn = fiber.tag === 14 ? t?.type : fiber.tag === 11 ? t?.render : t
        const name = `${n}:${t?.displayName || fn?.displayName || fn?.name || 'Anonymous'}`
        state.names[name] = (state.names[name] ?? 0) + 1
      }
      /* A person or activity row's own element (react-native-web hands the test id down as a prop). */
      const id = fiber.tag === 5 ? (fiber.memoizedProps?.['data-testid'] ?? '') : ''
      if (/^person-[^-]+.*$/.test(id) && !/-(chips|more|sync|deleted)$/.test(id) || /^activity-[a-zA-Z]+\.[a-zA-Z.]+$/.test(id)) {
        const kind = id.startsWith('person-') ? 'personRow' : 'activityRow'
        const n = `${kind}:${fiber.alternate ? 'update' : 'mount'}`
        if (!fiber.alternate || (fiber.flags & 1) === 1 || fiber.memoizedProps !== (fiber.alternate as Fiber).memoizedProps) {
          state.counts[n] = (state.counts[n] ?? 0) + 1
          if (!fiber.alternate) perCommit[kind] = (perCommit[kind] ?? 0) + 1
        }
      }
      if (!fiber.alternate || fiber.child !== fiber.alternate.child) walk(fiber.child)
    }
  }
  ;(window as unknown as {__REACT_DEVTOOLS_GLOBAL_HOOK__: unknown}).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject: () => 1,
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
    onCommitFiberRoot: (_id: number, root: {current: Fiber}) => {
      state.commits++
      perCommit = {}
      walk(root.current.child)
      for (const [k, n] of Object.entries(perCommit)) state.counts[`max:${k}`] = Math.max(state.counts[`max:${k}`] ?? 0, n)
    },
  }
  /* Reanimated's web exit animation clones the leaving node (`isDummy`). */
  ;(window as unknown as {__lwExits: number}).__lwExits = 0
  new MutationObserver(list => {
    for (const m of list)
      for (const n of m.addedNodes)
        if ((n as unknown as {isDummy?: boolean}).isDummy) (window as unknown as {__lwExits: number}).__lwExits++
  }).observe(document, {childList: true, subtree: true})
}

const PHONE = {width: 390, height: 844}
const CPU = Number(process.env.LISTWORK_CPU ?? 6)
const TEXT = 'rahul sharma 120'

test.use({viewport: PHONE, hasTouch: true, isMobile: true})
test.describe.configure({timeout: 600_000})

async function throttle(cdp: CDPSession, rate: number) {
  /* Playwright's session turns Chrome's accessibility tree on; a phone without a screen reader never builds it (17.1). */
  await cdp.send('Accessibility.disable').catch(() => {})
  await cdp.send('Emulation.setCPUThrottlingRate', {rate})
}

/* LISTWORK_PROFILE=1: a CPU profile of the measured step, self time per function (use a dev build for names). */
async function profileStart(cdp: CDPSession) {
  if (!process.env.LISTWORK_PROFILE) return
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', {interval: 200})
  await cdp.send('Profiler.start')
}

type ProfileNode = {id: number; callFrame: {functionName: string; url: string; lineNumber: number}; children?: number[]}
async function profileStop(cdp: CDPSession, label: string) {
  if (!process.env.LISTWORK_PROFILE) return
  const {profile} = (await cdp.send('Profiler.stop')) as unknown as {
    profile: {nodes: ProfileNode[]; samples: number[]; timeDeltas: number[]}
  }
  const self = new Map<number, number>()
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)))
  const byName = new Map<string, number>()
  const parent = new Map<number, number>()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const nodes = new Map(profile.nodes.map(n => [n.id, n]))
  const total = new Map<string, number>()
  for (const n of profile.nodes) {
    const f = n.callFrame
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()?.split('?')[0]}:${f.lineNumber}`
    byName.set(key, (byName.get(key) ?? 0) + (self.get(n.id) ?? 0))
  }
  /* Inclusive time per function name (once per sample stack). */
  profile.samples.forEach((id, i) => {
    const seen = new Set<string>()
    for (let cur: number | undefined = id; cur !== undefined; cur = parent.get(cur)) {
      const f = nodes.get(cur)!.callFrame
      const key = f.functionName || '(anon)'
      if (seen.has(key)) continue
      seen.add(key)
      total.set(key, (total.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0))
    }
  })
  const top = (m: Map<string, number>, n: number) =>
    [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `  ${(v / 1000).toFixed(1).padStart(8)} ms  ${k}`).join('\n')
  console.log(`PROFILE ${label} self:\n${top(byName, 45)}\nPROFILE ${label} inclusive:\n${top(total, 60)}`)
}

/* LISTWORK_TRACE=1: a timeline trace of the measured step; prints the main thread's time by event name inside tasks over 50 ms. */
async function traceStart(cdp: CDPSession) {
  if (!process.env.LISTWORK_TRACE) return
  await cdp.send('Tracing.start', {
    traceConfig: {includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute'], recordMode: 'recordAsMuchAsPossible'},
    transferMode: 'ReturnAsStream',
  } as never)
}

type TraceEvent = {name: string; ph: string; ts: number; dur?: number; tid: number; pid: number; args?: {data?: {frame?: string}}}
async function traceStop(cdp: CDPSession, label: string) {
  if (!process.env.LISTWORK_TRACE) return
  const done = new Promise<string>(resolve => cdp.once('Tracing.tracingComplete', (e: {stream?: string}) => resolve(e.stream!)))
  await cdp.send('Tracing.end')
  const stream = await done
  let text = ''
  for (;;) {
    const r = (await cdp.send('IO.read', {handle: stream})) as {data: string; eof: boolean}
    text += r.data
    if (r.eof) break
  }
  await cdp.send('IO.close', {handle: stream})
  const events = (JSON.parse(text) as {traceEvents: TraceEvent[]}).traceEvents
  const main = events.find(e => e.name === 'CrRendererMain' || (e as {args?: {name?: string}}).args?.name === 'CrRendererMain')
  const tid = main?.tid
  const onMain = events.filter(e => e.ph === 'X' && e.tid === tid && e.dur !== undefined)
  const tasks = onMain.filter(e => e.name === 'RunTask' && e.dur! > 50_000)
  const inside = (e: TraceEvent) => tasks.some(t => e.ts >= t.ts && e.ts + e.dur! <= t.ts + t.dur!)
  const by = new Map<string, number>()
  for (const e of onMain) if (e.name !== 'RunTask' && inside(e)) by.set(e.name, (by.get(e.name) ?? 0) + e.dur!)
  const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 25)
  console.log(
    `TRACE ${label}: ${tasks.length} tasks over 50 ms, ${(tasks.reduce((s, t) => s + t.dur!, 0) / 1000).toFixed(0)} ms in all; ` +
      `longest ${tasks.map(t => (t.dur! / 1000).toFixed(0)).sort((a, b) => Number(b) - Number(a)).slice(0, 6).join(', ')}\n` +
      top.map(([k, v]) => `  ${(v / 1000).toFixed(1).padStart(8)} ms  ${k}`).join('\n'),
  )
}

async function quiet(page: Page, ms = 1500) {
  await page.waitForTimeout(ms)
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as Win & {__lwExits: number}
    const out = {counts: {...w.__lw.counts}, names: {...w.__lw.names}, commits: w.__lw.commits, long: [...w.__lw.long], exits: w.__lwExits}
    w.__lw.reset()
    w.__lwExits = 0
    return out
  })
}

/** LISTWORK_NAMES=1: the components that rendered most (names only mean something in a dev build). */
function printNames(label: string, names: Counts) {
  if (!process.env.LISTWORK_NAMES) return
  const top = Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 70)
  console.log(`NAMES ${label}\n${top.map(([k, v]) => `  ${String(v).padStart(6)} ${k}`).join('\n')}`)
}

async function boot(page: Page, path: string, ready: string) {
  await page.addInitScript(instrument)
  await openDemo(page, path)
  await page.locator(ready).first().waitFor({timeout: 120_000})
  /* The large demo keeps loading history in the background; measure on a quiet app. */
  await quiet(page, 4000)
}

test('People search: a keystroke re-renders only what its answer changed', async ({page}) => {
  const cdp = await page.context().newCDPSession(page)
  await boot(page, '/people', '[data-testid="screen-people"] a[data-testid^="person-"]')
  const screen = page.getByTestId('screen-people')
  const rows = screen.locator('a[data-testid^="person-"]')
  const total = await rows.count()
  expect(total, 'friends listed').toBeGreaterThan(10)
  await screen.getByTestId('list-search').click()
  const input = screen.getByTestId('list-search-input')
  await expect(input).toBeVisible()
  await quiet(page, 800)
  /* Key-down to the painted echo, per key. */
  await page.evaluate(() => {
    const w = window as unknown as {__echo: number[]; __downs: number[]}
    w.__echo = []
    w.__downs = []
    addEventListener('keydown', e => w.__downs.push(e.timeStamp), true)
    addEventListener(
      'input',
      () => {
        const t = w.__downs.shift() ?? performance.now()
        requestAnimationFrame(() => {
          const ch = new MessageChannel()
          ch.port1.onmessage = () => w.__echo.push(performance.now() - t)
          ch.port2.postMessage(0)
        })
      },
      true,
    )
  })
  await snapshot(page)
  const load0 = loadavg()[0]!
  await throttle(cdp, CPU)
  await profileStart(cdp)
  await traceStart(cdp)
  await input.pressSequentially(TEXT, {delay: 45})
  await quiet(page, 2500)
  await traceStop(cdp, 'people-search')
  await profileStop(cdp, 'people-search')
  await throttle(cdp, 1)
  const s = await snapshot(page)
  printNames('people-search', s.names)
  const echo = await page.evaluate(() => (window as unknown as {__echo: number[]}).__echo)
  const keys = TEXT.length
  const perKey = (n: number | undefined) => (n ?? 0) / keys
  const result = {
    load: [load0, loadavg()[0]!].map(x => x.toFixed(1)),
    friends: total,
    keys,
    commits: s.commits,
    rendersPerKey: perKey((s.counts.mount ?? 0) + (s.counts.update ?? 0)).toFixed(1),
    mountsPerKey: perKey(s.counts.mount).toFixed(1),
    updatesPerKey: perKey(s.counts.update).toFixed(1),
    personRowMounts: s.counts['personRow:mount'] ?? 0,
    personRowUpdates: s.counts['personRow:update'] ?? 0,
    exitClones: s.exits,
    longTasks: s.long.length,
    longestTask: Math.round(Math.max(0, ...s.long)),
    worstEcho: Math.round(Math.max(0, ...echo)),
    medianEcho: Math.round([...echo].sort((a, b) => a - b)[Math.floor(echo.length / 2)] ?? 0),
  }
  console.log(`LISTWORK people-search x${CPU} ${JSON.stringify(result)}`)
  console.log(`LISTWORK people-search echo per key: ${echo.map(Math.round).join(' ')}; long tasks: ${s.long.map(Math.round).join(' ')}`)
  /*
   * Structural budget (17.1): a key renders the list and its heading, not the screen above it, and only the rows that came
   * or went, never every row; a row a key removes leaves without an exit clone. Before the fix (2026-10-31, large demo, 42
   * friends): 211 renders a key, 83 row re-renders and 46 exit clones over the 16 keys; after: 62-64, 2-4 and 0.
   */
  expect(Number(result.rendersPerKey), 'React renders per keystroke').toBeLessThan(100)
  expect(result.personRowUpdates, 'person rows re-rendered while typing').toBeLessThanOrEqual(8)
  expect(result.exitClones, 'rows cloned out by a keystroke').toBe(0)
})

test('Activity: the first fling mounts rows a slice at a time', async ({page}) => {
  const cdp = await page.context().newCDPSession(page)
  await boot(page, '/activity', '[data-testid="screen-activity"] [data-testid^="activity-"][data-testid*="."]')
  const screen = page.getByTestId('screen-activity')
  await expect(screen.getByTestId('activity-list')).toBeVisible({timeout: 60_000})
  await quiet(page, 2500)
  const before = await screen.locator('[data-testid^="activity-"][data-testid*="."]').count()
  await snapshot(page)
  const load0 = loadavg()[0]!
  await throttle(cdp, CPU)
  await profileStart(cdp)
  await traceStart(cdp)
  const frames = await page.evaluate(async () => {
    const stamps: number[] = []
    let on = true
    const loop = () => {
      stamps.push(performance.now())
      if (on) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    /* The sweep's fling: 40 px a frame for 30 frames down and back. */
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
    await new Promise(r => setTimeout(r, 300))
    on = false
    let maxGap = 0
    for (let i = 1; i < stamps.length; i++) maxGap = Math.max(maxGap, stamps[i]! - stamps[i - 1]!)
    return {maxGap}
  })
  await quiet(page, 2500)
  await traceStop(cdp, 'activity-fling')
  await profileStop(cdp, 'activity-fling')
  await throttle(cdp, 1)
  const s = await snapshot(page)
  printNames('activity-fling', s.names)
  const after = await screen.locator('[data-testid^="activity-"][data-testid*="."]').count()
  const result = {
    load: [load0, loadavg()[0]!].map(x => x.toFixed(1)),
    rowsBefore: before,
    rowsAfter: after,
    commits: s.commits,
    renders: (s.counts.mount ?? 0) + (s.counts.update ?? 0),
    activityRowMounts: s.counts['activityRow:mount'] ?? 0,
    activityRowUpdates: s.counts['activityRow:update'] ?? 0,
    mostRowsInOneCommit: s.counts['max:activityRow'] ?? 0,
    longTasks: s.long.length,
    longestTask: Math.round(Math.max(0, ...s.long)),
    worstFrame: Math.round(frames.maxGap),
  }
  console.log(`LISTWORK activity-fling x${CPU} ${JSON.stringify(result)}`)
  /*
   * Structural budget (17.1): the next page grows a few rows a commit (one commit mounted all 27 before), rows already
   * mounted never re-render because more were added under them, and a row costs what it draws (130 renders a row
   * before, with the closed row menu mounted on every row; 97 after).
   */
  const added = result.rowsAfter - result.rowsBefore
  expect(added, 'the fling reached the next page').toBeGreaterThan(10)
  expect(result.mostRowsInOneCommit, 'activity rows mounted by one commit').toBeLessThanOrEqual(8)
  expect(result.activityRowUpdates, 'mounted activity rows re-rendered by the fling').toBeLessThanOrEqual(2)
  expect(result.renders / added, 'React renders per added activity row').toBeLessThan(110)
})

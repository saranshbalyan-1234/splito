import {type CDPSession, expect, type Page, test} from '@playwright/test'

import {openDemo} from '../e2e/openDemo'

/*
 * What one save costs on a 500-expense ledger, with People open at desktop
 * width (sidebar, right column and the Activity badge mounted): IndexedDB
 * reads it triggers, React commits and component renders, long tasks, and the
 * time until the last read lands. Run: `pnpm perf` (see playwright.perf.config.ts).
 */

type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
  setPref(key: string, value: unknown): Promise<void>
}

type Perf = {reads: number; pending: number; lastDone: number; lastCommit: number; commits: number; renders: number; longTask: number}

const EXPENSES = 500
const RUNS = 3

/* Counts IndexedDB getAll requests, React commits and renders (DevTools-hook style), and long tasks. */
function instrument() {
  const perf: Perf = {reads: 0, pending: 0, lastDone: 0, lastCommit: 0, commits: 0, renders: 0, longTask: 0}
  ;(window as unknown as {__perf: Perf}).__perf = perf
  const wrap = (proto: {getAll: (...a: unknown[]) => IDBRequest}) => {
    const original = proto.getAll
    proto.getAll = function (this: unknown, ...args: unknown[]) {
      const req = original.apply(this, args)
      perf.reads++
      perf.pending++
      const done = () => {
        perf.pending--
        perf.lastDone = performance.now()
      }
      req.addEventListener('success', done)
      req.addEventListener('error', done)
      return req
    }
  }
  wrap(IDBObjectStore.prototype as never)
  wrap(IDBIndex.prototype as never)
  type Fiber = {tag: number; flags: number; child: Fiber | null; sibling: Fiber | null; alternate: Fiber | null}
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15])
  const walk = (f: Fiber | null) => {
    for (let fiber = f; fiber; fiber = fiber.sibling) {
      // PerformedWork (1): this fiber rendered in this commit; a new mount always did.
      if (COMPONENT_TAGS.has(fiber.tag) && (!fiber.alternate || (fiber.flags & 1) === 1)) perf.renders++
      // Children shared with the previous tree were skipped entirely.
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
      perf.commits++
      perf.lastCommit = performance.now()
      walk(root.current.child)
    },
  }
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) perf.longTask += e.duration
  }).observe({type: 'longtask', buffered: true})
}

/** Waits until no read is pending and none finished for 500 ms; returns ms from `start` to the last read. */
async function settle(page: Page, start: number) {
  await page.waitForFunction(
    () => {
      const p = (window as unknown as {__perf: Perf}).__perf
      return p.pending === 0 && performance.now() - Math.max(p.lastDone, p.lastCommit) > 500
    },
    undefined,
    {timeout: 300_000, polling: 100},
  )
  return page.evaluate(s => {
    const p = (window as unknown as {__perf: Perf}).__perf
    return {...p, ms: Math.max(0, Math.max(p.lastDone, p.lastCommit) - s)}
  }, start)
}

let cdp: CDPSession

/** Main-thread script and total task time so far, ms (Chrome's own counters). */
async function cpuMs() {
  const {metrics} = await cdp.send('Performance.getMetrics')
  const get = (name: string) => (metrics.find(m => m.name === name)?.value ?? 0) * 1000
  return {script: get('ScriptDuration'), task: get('TaskDuration')}
}

async function measure(page: Page, save: (s: Splito, i: number) => Promise<unknown>, i: number) {
  const before = await cpuMs()
  const start = await page.evaluate(() => {
    const p = (window as unknown as {__perf: Perf}).__perf
    Object.assign(p, {reads: 0, commits: 0, renders: 0, longTask: 0, lastDone: 0, lastCommit: 0})
    return performance.now()
  })
  await page.evaluate(
    ([source, n]) => {
      const splito = (window as unknown as {splito: Splito}).splito
      return (new Function('s', 'i', `return (${source})(s, i)`) as (s: Splito, i: number) => Promise<unknown>)(splito, n as number)
    },
    [save.toString(), i] as const,
  )
  const settled = await settle(page, start)
  const after = await cpuMs()
  return {...settled, scriptMs: after.script - before.script, taskMs: after.task - before.task}
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

test('one save on a 500-expense ledger', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.addInitScript(instrument)
  await openDemo(page)
  await expect(page.getByTestId('screen-people')).toBeVisible({timeout: 60_000})

  const seedStart = Date.now()
  await page.evaluate(async n => {
    const s = (window as unknown as {splito: Splito}).splito
    const friends = [await s.createPerson('Perf A'), await s.createPerson('Perf B'), await s.createPerson('Perf C')]
    for (let i = 0; i < n; i++) {
      const other = friends[i % 3]!
      const currency = i % 4 === 0 ? 'EUR' : 'INR'
      await s.createExpense({
        title: `Perf ${i}`,
        groupId: null,
        currency,
        total: String(1000 + i * 2),
        payers: {[i % 2 ? s.me : other]: String(1000 + i * 2)},
        split: {mode: 'equal', participants: [s.me, other]},
        date: `2026-0${1 + (i % 9)}-1${i % 10}`,
        tz: 'Asia/Kolkata',
        category: 'food',
        notes: '',
      })
    }
  }, EXPENSES)
  await settle(page, 0)
  const seedMs = Date.now() - seedStart

  // A mid-range phone runs JS about 4x slower than this machine.
  const cpu = Number(process.env.PERF_CPU ?? 4)
  cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: cpu})

  const results: Record<string, Awaited<ReturnType<typeof measure>>[]> = {pref: [], expense: []}
  for (let i = 0; i < RUNS; i++) {
    results.pref!.push(await measure(page, (s, n) => s.setPref('peopleSort', n % 2 ? 'amount' : 'name'), i))
    results.expense!.push(
      await measure(
        page,
        (s, n) =>
          s.createExpense({
            title: `Perf save ${n}`,
            groupId: null,
            currency: 'INR',
            total: '5000',
            payers: {[s.me]: '5000'},
            split: {mode: 'equal', participants: [s.me]},
            date: '2026-10-20',
            tz: 'Asia/Kolkata',
            category: 'food',
            notes: '',
          }),
        i,
      ),
    )
  }
  const summary = Object.fromEntries(
    Object.entries(results).map(([kind, runs]) => [
      kind,
      Object.fromEntries((['reads', 'commits', 'renders', 'longTask', 'scriptMs', 'taskMs', 'ms'] as const).map(k => [k, Math.round(median(runs.map(r => r[k])))])),
    ]),
  )
  console.log(`PERF ${JSON.stringify({dist: process.env.PERF_DIST ?? 'dist', expenses: EXPENSES, cpu, seedMs, ...summary})}`)
  expect(results.expense!.every(r => r.reads > 0)).toBe(true)
})

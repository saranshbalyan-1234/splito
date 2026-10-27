import {type CDPSession, expect, type Page, test} from '@playwright/test'

/*
 * F-117 budgets (ARCHITECTURE 9.8, 26.10), measured on web: Home cold open
 * under 150 ms and a write plus the UI showing it under 50 ms, on the large
 * demo set (about 1,500 expenses) and on a 10,000-expense ledger.
 *
 * "Cold open" runs from the app opening its local database (the migration
 * check included) to Home holding its figures (the marks `splito:store-open`
 * and `splito:home-ready`); the JS bundle's own load is outside it. "Write +
 * UI" runs from calling the mutation to the sidebar listing the new expense
 * (desktop width, so the right column and the Activity badge are mounted, the
 * worst case for re-reads). Each is the median of five runs. Run:
 * `pnpm perf -- schema-v2` after `pnpm e2e:build`; PERF_CPU throttles the CPU
 * (4 is a mid-range phone). Prints `PERF {json}` lines.
 */
type Splito = {
  me: string
  seedBulk(input: {friends: number; groups: number; expenses: number}): Promise<number>
  countExpenses(): Promise<number>
  legacyHomeMs(): Promise<number>
  createExpense(draft: unknown): Promise<string>
}

const RUNS = 5
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

async function coldOpen(page: Page) {
  await page.reload()
  await page.waitForFunction(() => performance.getEntriesByName('splito:home-ready').length > 0, undefined, {timeout: 120_000})
  return page.evaluate(() => {
    const at = (name: string) => performance.getEntriesByName(name)[0]!.startTime
    return {
      /** Store open to Home holding its figures. */
      home: at('splito:home-ready') - at('splito:store-open'),
      /** Of which: opening the database (the version check included), ensuring "me", the demo check. */
      open: at('splito:store-ready') - at('splito:store-open'),
    }
  })
}

async function writeAndSee(page: Page, i: number) {
  return page.evaluate(async n => {
    const s = (window as unknown as {splito: Splito}).splito
    const title = `Perf write ${n} ${Math.random().toString(36).slice(2, 8)}`
    const t0 = performance.now()
    await s.createExpense({
      title,
      groupId: null,
      currency: 'INR',
      total: '5000',
      payers: {[s.me]: '5000'},
      split: {mode: 'equal', participants: [s.me]},
      date: '2026-12-30',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
    })
    const committed = performance.now() - t0
    await new Promise<void>(resolve => {
      const check = () => (document.querySelector('[data-testid="sidebar-recent-transactions"]')?.textContent?.includes(title) ? resolve() : requestAnimationFrame(check))
      check()
    })
    return {committed, ui: performance.now() - t0}
  }, i)
}

async function measure(page: Page, label: string, extra: Record<string, unknown>) {
  await page.waitForFunction(() => 'splito' in window)
  const expenses = await page.evaluate(() => (window as unknown as {splito: Splito}).splito.countExpenses())
  const opens: Awaited<ReturnType<typeof coldOpen>>[] = []
  for (let i = 0; i < RUNS; i++) opens.push(await coldOpen(page))
  await expect(page.getByTestId('sidebar-recent-transactions')).toBeVisible()
  // The path this replaced: read every record, then work each balance out of the ledger.
  const legacy: number[] = []
  for (let i = 0; i < RUNS; i++) legacy.push(await page.evaluate(() => (window as unknown as {splito: Splito}).splito.legacyHomeMs()))
  const writes: Awaited<ReturnType<typeof writeAndSee>>[] = []
  for (let i = 0; i < RUNS; i++) writes.push(await writeAndSee(page, i))
  const result = {
    set: label,
    cpu: Number(process.env.PERF_CPU ?? 1),
    expenses,
    ...extra,
    coldOpenHomeMs: Math.round(median(opens.map(o => o.home))),
    coldOpenDbMs: Math.round(median(opens.map(o => o.open))),
    /** Reading the whole ledger and computing balances from it: what Home's open cost before schema v2 (data read only, no render). */
    previousHomeReadMs: Math.round(median(legacy)),
    writeCommitMs: Math.round(median(writes.map(w => w.committed))),
    writeAndUiMs: Math.round(median(writes.map(w => w.ui))),
    runs: {coldOpen: opens.map(o => Math.round(o.home)), writeAndUi: writes.map(w => Math.round(w.ui))},
  }
  console.log(`PERF ${JSON.stringify(result)}`)
  return result
}

let cdp: CDPSession
async function throttle(page: Page) {
  const rate = Number(process.env.PERF_CPU ?? 1)
  cdp = await page.context().newCDPSession(page)
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', {rate})
}

test('the large demo set: Home cold open and a write', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto('/?demo=large')
  await expect(page.getByText(/Demo data added/)).toBeVisible({timeout: 120_000})
  await throttle(page)
  const r = await measure(page, 'large demo set', {})
  expect(r.coldOpenHomeMs).toBeGreaterThan(0)
})

test('a 10,000-expense ledger: Home cold open and a write', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  const seedMs = await page.evaluate(() => (window as unknown as {splito: Splito}).splito.seedBulk({friends: 60, groups: 12, expenses: 10_000}))
  await throttle(page)
  const r = await measure(page, '10,000 expenses', {seedMs})
  expect(r.coldOpenHomeMs).toBeGreaterThan(0)
})

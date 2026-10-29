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
 * worst case for re-reads). "Analytics open" runs from the tap on the Analytics
 * tab to the summary and charts showing figures (default year period, one
 * currency); "search keystroke" from setting the field's text to the first page
 * of results showing the query's matches, however many there are (budget 50 ms,
 * ARCHITECTURE 9.8, 17, 26.10); the per-currency totals of a broad match fill in
 * after that and are timed on their own (`totalsMs`, no budget). "Ask" (owner
 * decision 107): the Ask tab to the chat's composer on screen (`askOpenMs`, one
 * frame) and Enter on "Who owes me the most?" to the answer on screen (`askAnswerMs`,
 * budget 150 ms), with typed text arriving whole in the field. Each is
 * the median of five runs. Run:
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

async function measure(page: Page, label: string, extra: Record<string, unknown>, queries: Array<{q: string; shows: string}>) {
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
  // Analytics: the tab to figures on screen (the default year, the busiest currency).
  const analytics: number[] = []
  for (let i = 0; i < RUNS; i++) {
    await page.getByTestId('tab-people').click()
    await expect(page.getByTestId('sidebar-recent-transactions')).toBeVisible()
    analytics.push(await openTab(page, 'tab-analytics', 'analytics-expenses-title'))
  }
  // Search: one keystroke-sized change to the first page of results, for narrow and broad queries (the Search & Ask drawer).
  await page.getByTestId('header-search-ask').last().click()
  await expect(page.getByTestId('search-input')).toBeVisible()
  const searches: Record<string, number> = {}
  const searchTotals: Record<string, number> = {}
  for (const {q, shows} of queries) {
    const runs: Awaited<ReturnType<typeof searchFor>>[] = []
    for (let i = 0; i < RUNS; i++) {
      await page.getByTestId('search-input').fill('')
      runs.push(await searchFor(page, q, shows))
    }
    searches[q] = Math.round(median(runs.map(r => r.first)))
    searchTotals[q] = Math.round(median(runs.map(r => r.totals)))
  }
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
    analyticsOpenMs: Math.round(median(analytics)),
    searchKeystrokeMs: searches,
    /** Of a broad match, the count and totals filling in after that first page (no budget; cancelled by the next keystroke). */
    searchTotalsMs: searchTotals,
    runs: {coldOpen: opens.map(o => Math.round(o.home)), writeAndUi: writes.map(w => Math.round(w.ui))},
  }
  console.log(`PERF ${JSON.stringify(result)}`)
  return result
}

/** Taps a tab and waits for `ready` to appear: the time between the two, in the page's own clock. */
async function openTab(page: Page, tab: string, ready: string) {
  return page.evaluate(
    ({tab, ready}) =>
      new Promise<number>((resolve, reject) => {
        const t0 = performance.now()
        document.querySelector<HTMLElement>(`[data-testid="${tab}"]`)?.click()
        const deadline = t0 + 30_000
        const check = () => {
          if (document.querySelector(`[data-testid="${ready}"]`)) resolve(performance.now() - t0)
          else if (performance.now() > deadline) reject(new Error('timed out waiting for ' + ready))
          else requestAnimationFrame(check)
        }
        check()
      }),
    {tab, ready},
  )
}

/**
 * Types a query into the search field. `first`: until the first result row holds `shows` (the query's own match).
 * `totals`: until the expenses heading has its count and totals (no "Calculating totals…" left).
 */
async function searchFor(page: Page, query: string, shows: string) {
  return page.evaluate(
    ({query, shows}) =>
      new Promise<{first: number; totals: number}>((resolve, reject) => {
        const input = document.querySelector<HTMLInputElement>('[data-testid="search-input"]')!
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        const t0 = performance.now()
        set.call(input, query)
        input.dispatchEvent(new Event('input', {bubbles: true}))
        const deadline = t0 + 60_000
        let first: number | undefined
        const check = () => {
          const now = performance.now()
          // The "Ask Splito" row heads the results and repeats the query, so it is not a match.
          const rows = [...document.querySelectorAll('[data-testid^="search-row-"]')].filter(r => !r.textContent?.includes('Ask Splito'))
          if (first === undefined && rows.some(r => r.textContent?.includes(shows))) first = now - t0
          if (first !== undefined && document.querySelector('[data-testid="search-section-expenses"]') && !document.querySelector('[data-testid="search-totals-pending"]'))
            resolve({first, totals: now - t0})
          else if (now > deadline) reject(new Error(`timed out searching "${query}" for "${shows}"`))
          else requestAnimationFrame(check)
        }
        check()
      }),
    {query, shows},
  )
}

/** Keystroke to first page of results: under 50 ms for every query, broad ones included (the budget is for an unthrottled CPU). */
function expectSearchBudget(r: {cpu: number; searchKeystrokeMs: Record<string, number>}) {
  if (r.cpu > 1) return
  for (const [q, ms] of Object.entries(r.searchKeystrokeMs)) expect(ms, `search "${q}"`).toBeLessThan(50)
}

/**
 * Ask Splito on a large ledger: the sidebar's Ask tab to the composer on screen, then a question and Enter to
 * the answer bubble on screen. Also types a long sentence into the field at full speed and checks no
 * character is lost (decision 107: typing must never drop a character).
 */
async function askCase(page: Page) {
  // Ask Splito is off the default bar, so put it on the sidebar (26.3) to measure its tab.
  await page.evaluate(() =>
    (window as any).splito.setPref('tabs', ['people', 'groups', 'analytics', 'ask', 'activity']),
  )
  await page.getByTestId('tab-ask').waitFor()
  const question = 'Who owes me the most?'
  const opens: number[] = []
  const answers: number[] = []
  for (let i = 0; i < RUNS; i++) {
    opens.push(
      await page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const t0 = performance.now()
            document.querySelector<HTMLElement>('[data-testid="tab-ask"]')!.click()
            const deadline = t0 + 30_000
            const check = () => {
              if (document.querySelector('[data-testid="ask-input"]')) resolve(performance.now() - t0)
              else if (performance.now() > deadline) reject(new Error('the Ask composer never appeared'))
              else requestAnimationFrame(check)
            }
            check()
          }),
      ),
    )
    const waiting = page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          addEventListener(
            'keydown',
            e => {
              if ((e as KeyboardEvent).key !== 'Enter') return
              const t0 = performance.now()
              const check = () => {
                if (document.querySelector('[data-testid="ask-message-ask"]')) resolve(performance.now() - t0)
                else if (performance.now() > t0 + 30_000) reject(new Error('no answer'))
                else requestAnimationFrame(check)
              }
              check()
            },
            {capture: true, once: true},
          )
        }),
    )
    await page.getByTestId('ask-input').fill(question)
    await page.getByTestId('ask-input').press('Enter')
    answers.push(await waiting)
    // The next run starts from an empty chat, so the list never grows under the measurement.
    await page.getByTestId('ask-clear').click()
    await page.getByRole('button', {name: 'Clear', exact: true}).click()
    await expect(page.getByTestId('ask-empty')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ask-chat')).toHaveCount(0)
  }
  // Typing at full speed: every character arrives, in the chat and in Search.
  const sentence = 'how much did I spend on food last month and who owes me the most 1,234.50'
  await page.getByTestId('tab-ask').click()
  await page.getByTestId('ask-input').pressSequentially(sentence, {delay: 0})
  const typedInChat = await page.getByTestId('ask-input').inputValue()
  await page.keyboard.press('Escape')
  await page.getByTestId('header-search-ask').last().click()
  await page.getByTestId('search-input').pressSequentially(sentence, {delay: 0})
  const typedInSearch = await page.getByTestId('search-input').inputValue()
  await page.keyboard.press('Escape')
  const result = {
    set: '10,000 expenses ask',
    cpu: Number(process.env.PERF_CPU ?? 1),
    askOpenMs: Math.round(median(opens)),
    askAnswerMs: Math.round(median(answers)),
    runs: {open: opens.map(Math.round), answer: answers.map(Math.round)},
    typing: {chat: typedInChat === sentence, search: typedInSearch === sentence},
  }
  console.log(`PERF ${JSON.stringify(result)}`)
  return {...result, typedInChat, typedInSearch, sentence}
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
  const r = await measure(page, 'large demo set', {}, [
    {q: 'udaipur', shows: 'Udaipur'},
    {q: 'netflix', shows: 'Netflix'},
    {q: 'goa', shows: 'Goa'},
  ])
  expect(r.coldOpenHomeMs).toBeGreaterThan(0)
  expectSearchBudget(r)
})

test('a 10,000-expense ledger: Home cold open and a write', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  const seedMs = await page.evaluate(() => (window as unknown as {splito: Splito}).splito.seedBulk({friends: 60, groups: 12, expenses: 10_000}))
  await throttle(page)
  const r = await measure(page, '10,000 expenses', {seedMs}, [
    {q: 'Bulk expense 9993', shows: 'Bulk expense 9993'},
    {q: 'Bulk Friend 4', shows: 'Bulk'},
    {q: 'perf write', shows: 'Perf write'},
    {q: '> 90', shows: 'Bulk'},
  ])
  expect(r.coldOpenHomeMs).toBeGreaterThan(0)
  expectSearchBudget(r)
  // Ask Splito on the same ledger (decision 107): under 150 ms from Enter to the answer, and no character lost.
  await page.keyboard.press('Escape')
  const ask = await askCase(page)
  expect(ask.typedInChat).toBe(ask.sentence)
  expect(ask.typedInSearch).toBe(ask.sentence)
  if (ask.cpu <= 1) expect(ask.askAnswerMs, 'Who owes me the most? to the answer').toBeLessThan(150)
})

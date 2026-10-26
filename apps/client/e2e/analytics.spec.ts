import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

/*
 * A known ledger, seeded through the real mutations (window.splito, E2E
 * builds only), with the clock fixed at 2026-10-26 12:00 in Kolkata. Every
 * amount below is worked out by hand, so the chart labels, the list, the
 * totals and the CSV are checked against the same numbers.
 *
 *   Date        Title        Group  Cur  Total     Paid by  Split (equal)     My share
 *   2026-09-28  Groceries    -      INR    800.00  me       me, Riya             400.00
 *   2026-10-05  Dinner       -      INR  1,500.00  me       me, Riya, Sam        500.00
 *   2026-10-10  Lunch        -      INR    999.00  me       me                 deleted
 *   2026-10-12  Cab          Goa    INR    900.00  Riya     me, Riya, Sam        300.00
 *   2026-10-15  Museum       -      EUR     30.00  me       me, Sam               15.00
 *   2026-10-20  Hotel        Goa    INR  6,000.00  Sam      me, Sam            3,000.00
 *   2026-10-22  =HYPERLINK.. -      INR    200.00  Riya     me, Riya             100.00
 */
const NOW = new Date('2026-10-26T06:30:00Z')
const FORMULA = '=HYPERLINK("http://x")'
const LOCALE = 'en-US'

const MESSAGE_IDS = Object.keys(
  JSON.parse(
    JSON.parse(
      readFileSync(
        join(__dirname, '../src/locale/locales/en/messages.ts'),
        'utf8',
      ).match(/JSON\.parse\(("(?:[^"\\]|\\.)*")\)/)![1]!,
    ),
  ),
)

type Row = {
  title: string
  group?: 'goa'
  currency?: 'INR' | 'EUR'
  total: string
  payer: 'me' | 'riya' | 'sam'
  with: Array<'me' | 'riya' | 'sam'>
  date: string
  category: string
  isDeleted?: boolean
}

async function seed(page: Page, rows: Row[], now = NOW) {
  await page.clock.setFixedTime(now)
  await page.goto('/analytics')
  await expect(page.getByTestId('screen-analytics')).toBeVisible()
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async rows => {
    type Splito = {
      me: string
      createPerson(name: string): Promise<string>
      createGroup(input: unknown): Promise<string>
      createExpense(draft: unknown): Promise<string>
      deleteExpense(id: string): Promise<void>
    }
    const s = (window as unknown as {splito: Splito}).splito
    const ids = {
      me: s.me,
      riya: await s.createPerson('Riya Sharma'),
      sam: await s.createPerson('Sam Carter'),
    }
    const goa = await s.createGroup({
      name: 'Goa',
      kind: 'trip',
      currency: 'INR',
      startDate: null,
      endDate: null,
      memberIds: [ids.riya, ids.sam],
    })
    for (const r of rows) {
      const id = await s.createExpense({
        title: r.title,
        groupId: r.group ? goa : null,
        currency: r.currency ?? 'INR',
        total: r.total,
        payers: {[ids[r.payer]]: r.total},
        split: {mode: 'equal', participants: r.with.map(p => ids[p])},
        date: r.date,
        tz: 'Asia/Kolkata',
        category: r.category,
        notes: '',
      })
      if (r.isDeleted) await s.deleteExpense(id)
    }
  }, rows)
}

const LEDGER: Row[] = [
  {
    title: 'Groceries',
    total: '80000',
    payer: 'me',
    with: ['me', 'riya'],
    date: '2026-09-28',
    category: 'groceries',
  },
  {
    title: 'Dinner',
    total: '150000',
    payer: 'me',
    with: ['me', 'riya', 'sam'],
    date: '2026-10-05',
    category: 'food',
  },
  {
    title: 'Lunch',
    total: '99900',
    payer: 'me',
    with: ['me'],
    date: '2026-10-10',
    category: 'food',
    isDeleted: true,
  },
  {
    title: 'Cab',
    group: 'goa',
    total: '90000',
    payer: 'riya',
    with: ['me', 'riya', 'sam'],
    date: '2026-10-12',
    category: 'transport',
  },
  {
    title: 'Museum',
    currency: 'EUR',
    total: '3000',
    payer: 'me',
    with: ['me', 'sam'],
    date: '2026-10-15',
    category: 'entertainment',
  },
  {
    title: 'Hotel',
    group: 'goa',
    total: '600000',
    payer: 'sam',
    with: ['me', 'sam'],
    date: '2026-10-20',
    category: 'stay',
  },
  {
    title: FORMULA,
    total: '20000',
    payer: 'riya',
    with: ['me', 'riya'],
    date: '2026-10-22',
    category: 'other',
  },
]

const inr = (n: number) =>
  new Intl.NumberFormat(LOCALE, {style: 'currency', currency: 'INR'}).format(n)

async function expectTotals(
  page: Page,
  t: {share: number; paid: number; total: number; count: number},
) {
  await expect(page.getByTestId('analytics-total-share')).toHaveText(
    inr(t.share),
  )
  await expect(page.getByTestId('analytics-total-paid')).toHaveText(inr(t.paid))
  await expect(page.getByTestId('analytics-total-all')).toHaveText(inr(t.total))
  await expect(page.getByTestId('analytics-count')).toHaveText(String(t.count))
  await expect(page.getByTestId('analytics-expenses-title')).toHaveText(
    `Expenses  ${t.count}`,
  )
}

test.use({
  timezoneId: 'Asia/Kolkata',
  locale: LOCALE,
  viewport: {width: 1440, height: 900},
})

test('this year: totals, every chart label, the list and the CSV agree', async ({
  page,
}) => {
  await seed(page, LEDGER)
  await expect(page.getByTestId('analytics-period-label')).toHaveText('2026')
  /* INR only: the EUR museum ticket and the deleted lunch are not in any figure. */
  await expectTotals(page, {share: 4300, paid: 2300, total: 9400, count: 5})

  /* Spending over time: hover a bar for its value. */
  await page.getByTestId('analytics-over-time-chart-bar-2026-10-01').hover()
  await expect(
    page.getByTestId('analytics-over-time-chart-tooltip'),
  ).toHaveText(`${inr(3900)}October 2026`)
  await page.getByTestId('analytics-over-time-chart-bar-2026-09-01').hover()
  await expect(
    page.getByTestId('analytics-over-time-chart-tooltip'),
  ).toHaveText(`${inr(400)}September 2026`)

  /* By category (your share), largest first. */
  const categories: [string, number][] = [
    ['stay', 3000],
    ['food', 500],
    ['groceries', 400],
    ['transport', 300],
    ['other', 100],
  ]
  for (const [id, amount] of categories) {
    await expect(
      page.getByTestId(`analytics-by-category-chart-${id}-amount`),
    ).toHaveText(inr(amount))
  }
  await expect(
    page.getByTestId('analytics-by-category-chart-center'),
  ).toHaveText(inr(4300))

  /* Paid vs share: you paid 2,300, your share 4,300, so others covered 2,000. */
  await expect(
    page.getByTestId('analytics-paid-vs-share-chart-You paid-amount'),
  ).toHaveText(inr(2300))
  await expect(
    page.getByTestId('analytics-paid-vs-share-chart-Your share-amount'),
  ).toHaveText(inr(4300))
  await expect(page.getByTestId('analytics-covered')).toHaveText(inr(2000))

  /* By person: everyone's share of the same five expenses. */
  await expect(
    page.getByTestId('analytics-by-person-chart-You-amount'),
  ).toHaveText(inr(4300))
  await expect(
    page.getByTestId('analytics-by-person-chart-Sam Carter-amount'),
  ).toHaveText(inr(3800))
  await expect(
    page.getByTestId('analytics-by-person-chart-Riya Sharma-amount'),
  ).toHaveText(inr(1300))

  /* By group: your share in Goa and outside any group. */
  await expect(
    page.getByTestId('analytics-by-group-chart-Goa-amount'),
  ).toHaveText(inr(3300))
  await expect(
    page.getByTestId('analytics-by-group-chart-Direct-amount'),
  ).toHaveText(inr(1000))

  /* Balance: Riya owes 400 + 500 - 300 - 100 = 500; I owe Sam 3,000 - 500 = 2,500. Net -2,000. */
  await expect(page.getByTestId('analytics-trend-latest')).toHaveText(
    `you owe ${inr(2000)}`,
  )

  /* The list: newest first, with my share of each. */
  const shares = page.getByTestId('analytics-expense-share')
  await expect(shares).toHaveText([
    inr(100),
    inr(3000),
    inr(300),
    inr(500),
    inr(400),
  ])

  /* CSV: same rows, exact decimals, a currency column, the formula defused. */
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('analytics-export').click(),
  ])
  expect(download.suggestedFilename()).toBe(
    'splito-INR-2026-01-01-to-2026-12-31.csv',
  )
  expect(readFileSync((await download.path())!, 'utf8')).toBe(
    '﻿' +
      'Date,Description,Category,Group,Currency,Total,You paid,Your share\r\n' +
      `2026-10-22,"'=HYPERLINK(""http://x"")",Other,,INR,200.00,0.00,100.00\r\n` +
      '2026-10-20,Hotel,Stay,Goa,INR,6000.00,0.00,3000.00\r\n' +
      '2026-10-12,Cab,Transport,Goa,INR,900.00,0.00,300.00\r\n' +
      '2026-10-05,Dinner,Food,,INR,1500.00,1500.00,500.00\r\n' +
      '2026-09-28,Groceries,Groceries,,INR,800.00,800.00,400.00\r\n',
  )

  const words = new Set((await page.locator('body').innerText()).split(/\s+/))
  expect(MESSAGE_IDS.filter(id => words.has(id))).toEqual([])
})

test('the filter bar drives everything: month, include groups, group, currency', async ({
  page,
}) => {
  await seed(page, LEDGER)

  await page.getByTestId('analytics-period').click()
  await page.getByTestId('analytics-period-month').click()
  await expect(page.getByTestId('analytics-period-label')).toHaveText(
    'October 2026',
  )
  await expectTotals(page, {share: 3900, paid: 1500, total: 8600, count: 4})

  /* Previous month holds only the groceries. */
  await page.getByTestId('analytics-prev').click()
  await expect(page.getByTestId('analytics-period-label')).toHaveText(
    'September 2026',
  )
  await expectTotals(page, {share: 400, paid: 800, total: 800, count: 1})
  await page.getByTestId('analytics-next').click()

  /* Include groups off: non-group expenses only. */
  await page.getByTestId('analytics-include-groups').click()
  await expectTotals(page, {share: 600, paid: 1500, total: 1700, count: 2})
  await page.getByTestId('analytics-include-groups').click()

  /* One group. */
  await page.getByTestId('analytics-group').click()
  await page.getByTestId('analytics-group-Goa').click()
  await expectTotals(page, {share: 3300, paid: 0, total: 6900, count: 2})
  await page.getByTestId('analytics-group').click()
  await page.getByTestId('analytics-group-all').click()

  /* EUR on its own; never added to rupees. */
  await page.getByTestId('analytics-currency').click()
  await page.getByTestId('analytics-currency-EUR').click()
  await expect(page.getByTestId('analytics-total-share')).toHaveText('€15.00')
  await expect(page.getByTestId('analytics-total-all')).toHaveText('€30.00')
})

test('tapping a slice, a bar or a person narrows the list to it, with matching totals', async ({
  page,
}) => {
  await seed(page, LEDGER)
  const shares = page.getByTestId('analytics-expense-share')

  await page.getByTestId('analytics-by-category-chart-stay').click()
  await expect(page.getByTestId('analytics-selection')).toHaveText('Stay')
  await expect(shares).toHaveText([inr(3000)])
  await expect(page.getByTestId('analytics-selection-total')).toHaveText(
    `Your share ${inr(3000)}`,
  )
  await page.getByTestId('analytics-selection').click()
  await expect(shares).toHaveCount(5)

  await page.getByTestId('analytics-over-time-chart-bar-2026-09-01').click()
  await expect(page.getByTestId('analytics-selection')).toHaveText(
    'September 2026',
  )
  await expect(shares).toHaveText([inr(400)])

  /* A person's row lists the expenses they share in, showing their share. */
  await page.getByTestId('analytics-by-person-chart-Sam Carter').click()
  await expect(page.getByTestId('analytics-selection-total')).toHaveText(
    `Sam Carter’s share ${inr(3800)}`,
  )
  await expect(shares).toHaveText([inr(3000), inr(300), inr(500)])
})

test('table view shows the same numbers as the charts', async ({page}) => {
  await seed(page, LEDGER)
  await page.getByTestId('analytics-view-toggle').click()
  await expect(
    page.getByTestId('analytics-over-time-table-2026-10-01'),
  ).toHaveText(['October 2026', inr(3900), inr(1500), '4'].join(''))
  await expect(page.getByTestId('analytics-by-category-table-stay')).toHaveText(
    ['Stay', inr(3000), '70%', '1'].join(''),
  )
  await expect(page.getByTestId('analytics-over-time-chart')).toHaveCount(0)
  /* The choice is a preference: it survives a reload. */
  await page.reload()
  await expect(page.getByTestId('analytics-over-time-table')).toBeVisible()
})

/* An expense on 31 October, read at 2026-10-31 20:00 UTC: already 1 November in Kolkata, still October in Los Angeles. */
const LATE = new Date('2026-10-31T20:00:00Z')
const SNACK: Row[] = [
  {
    title: 'Late snack',
    total: '30000',
    payer: 'me',
    with: ['me'],
    date: '2026-10-31',
    category: 'food',
  },
]

for (const [timezoneId, label, share] of [
  ['Asia/Kolkata', 'November 2026', null],
  ['America/Los_Angeles', 'October 2026', 300],
] as const) {
  test.describe(timezoneId, () => {
    test.use({timezoneId})
    test(`"this month" is ${label} at the same instant`, async ({page}) => {
      await seed(page, SNACK, LATE)
      await page.getByTestId('analytics-period').click()
      await page.getByTestId('analytics-period-month').click()
      await expect(page.getByTestId('analytics-period-label')).toHaveText(label)
      if (share === null) {
        await expect(page.getByTestId('analytics-period-empty')).toHaveText(
          /No INR expenses in November 2026/,
        )
      } else {
        await expect(page.getByTestId('analytics-total-share')).toHaveText(
          inr(share),
        )
      }
    })
  })
}

test('no expenses yet: an honest empty state with the way forward', async ({
  page,
}) => {
  await page.goto('/analytics')
  await expect(page.getByTestId('analytics-empty')).toBeVisible()
  await expect(page.getByTestId('analytics-empty')).toContainText(
    'once you add an expense',
  )
})

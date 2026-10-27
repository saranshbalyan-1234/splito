import {expect, type Page, test} from '@playwright/test'

/*
 * F-115 (logic audit M9, M18, m23, m25, m29): the Timezone, Date format and
 * Number format preferences apply on every screen, and "today" moves on with
 * the clock. The device is in Los Angeles while the preference says Kolkata,
 * so a screen that reads the device zone shows the wrong day.
 */

type Row = {id: string; data: Record<string, unknown>}
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
  setPref(key: string, value: unknown): Promise<void>
  list(type: string): Promise<Row[]>
}

const DESKTOP = {width: 1440, height: 900}

test.use({viewport: DESKTOP, timezoneId: 'America/Los_Angeles', locale: 'en-US'})

/** 2026-10-26 20:00 UTC: 13:00 in Los Angeles, 01:30 on the 27th in Kolkata. */
const AT = '2026-10-26T20:00:00Z'

async function boot(page: Page, at = AT) {
  await page.clock.install({time: new Date(at)})
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
}

/** Bob owes me INR 500, dated in Kolkata (the preference). */
async function seed(page: Page, extra: Record<string, unknown> = {}) {
  return page.evaluate(async extra => {
    const s = (window as unknown as {splito: Splito}).splito
    await s.setPref('timezone', 'Asia/Kolkata')
    const bob = await s.createPerson('Bob Lee')
    const expense = await s.createExpense({
      title: 'Chai',
      groupId: null,
      currency: 'INR',
      total: '100000',
      payers: {[s.me]: '100000'},
      split: {mode: 'equal', participants: [s.me, bob]},
      date: '2026-10-27',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      ...extra,
    })
    return {bob, expense}
  }, extra)
}

const list = (page: Page, type: string) =>
  page.evaluate(
    t => (window as unknown as {splito: Splito}).splito.list(t),
    type,
  )

test('M9: Record payment is dated in the Timezone preference, like the expense it settles', async ({
  page,
}) => {
  await boot(page)
  const {bob} = await seed(page)
  await page.goto(`/people/${bob}`)
  await page.getByTestId('person-record-payment').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('payment-recorded')).toBeVisible()
  const [payment] = await list(page, 'repayment')
  expect(payment!.data.date).toBe('2026-10-27')
  expect(payment!.data.tz).toBe('Asia/Kolkata')
})

test('M9: Call it even is dated in the Timezone preference', async ({page}) => {
  await boot(page)
  const {bob} = await seed(page)
  await page.goto(`/people/${bob}`)
  await page.getByTestId('person-more').click()
  await page.getByTestId('person-call-even').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('call-even-done')).toBeVisible()
  const [writeOff] = await list(page, 'writeoff')
  expect(writeOff!.data.date).toBe('2026-10-27')
  expect(writeOff!.data.tz).toBe('Asia/Kolkata')
})

test('M18: the Date format preference applies on the Expense screen and the edit form', async ({
  page,
}) => {
  await boot(page)
  const {expense} = await seed(page, {date: '2026-10-20'})
  await page.evaluate(() =>
    (window as unknown as {splito: Splito}).splito.setPref('dateFormat', 'ymd'),
  )
  await page.goto(`/expense/${expense}`)
  await expect(page.getByTestId('expense-detail-date')).toHaveText(
    'Tuesday, 2026-10-20',
  )
  await page.getByTestId('expense-edit-button').click()
  await expect(page.getByTestId('expense-date')).toContainText('2026-10-20')
})

test('m25: percentages follow the Number format preference', async ({page}) => {
  await boot(page)
  const {expense} = await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    await s.setPref('numberLocale', 'de-DE')
    const bob = await s.createPerson('Bob Lee')
    const expense = await s.createExpense({
      title: 'Cab',
      groupId: null,
      currency: 'INR',
      total: '10000',
      payers: {[s.me]: '10000'},
      split: {mode: 'percent', basisPoints: {[s.me]: 3333, [bob]: 6667}},
      date: '2026-10-26',
      tz: 'America/Los_Angeles',
      category: 'travel',
      notes: '',
    })
    return {expense}
  })
  await page.goto(`/expense/${expense}`)
  await expect(page.getByTestId('share-row-Bob Lee')).toContainText('66,67%')
})

/** An expense created at AT, then the clock moves to `now`. */
async function activityAt(page: Page, now: string) {
  await boot(page)
  await seed(page)
  await page.clock.setFixedTime(new Date(now))
  await page.goto('/activity')
  await expect(page.getByTestId('screen-activity')).toBeVisible()
}

test('m23: Activity groups days by the Timezone preference, not the device zone', async ({
  page,
}) => {
  // 08:00 UTC on the 27th: still the 26th in Los Angeles, 13:30 on the 27th in Kolkata.
  await activityAt(page, '2026-10-27T08:00:00Z')
  await expect(page.getByTestId('activity-day-header').first()).toHaveText(
    'Today',
  )
})

test('m29: Today moves on at midnight without a reload', async ({page}) => {
  // 13:30 on the 27th in Kolkata, when the expense is made.
  await boot(page, '2026-10-27T08:00:00Z')
  await seed(page)
  await page.goto('/activity')
  await expect(page.getByTestId('screen-activity')).toBeVisible()
  await expect(page.getByTestId('activity-day-header').first()).toHaveText(
    'Today',
  )
  await page.clock.fastForward('24:00:00')
  await expect(page.getByTestId('activity-day-header').first()).toHaveText(
    'Yesterday',
  )
})

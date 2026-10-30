import {expect, type Page, test} from '@playwright/test'

import {type SplitoDevTools} from '../src/data/devTools'
import {openApp} from './app'

/**
 * A browser whose Notification API answers like a granted-after-asking one. The share sheet is never opened: the e2e
 * build records the shared text on window.__splitoTest.sharedTexts (owner 118).
 */
async function stubBrowser(page: Page, permission: 'default' | 'granted' = 'default') {
  await page.addInitScript(initial => {
    const w = window as unknown as Record<string, unknown>
    class FakeNotification {
      static permission = initial
      static async requestPermission() {
        FakeNotification.permission = 'granted'
        return 'granted'
      }
      onclick: (() => void) | null = null
      close() {}
    }
    w.Notification = FakeNotification
  }, permission)
}

/** Bob owes me ₹450 and €20 directly and ₹200 in Goa; Cara owes me nothing. */
async function seed(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: SplitoDevTools}).splito
    const bob = await s.createPerson('Bob Mehta')
    const cara = await s.createPerson('Cara Rao')
    const group = await s.createGroup({name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [bob, cara]})
    const base = {tz: 'Asia/Kolkata', category: 'food', notes: '', date: '2026-10-20', split: {mode: 'equal', participants: [s.me, bob]}, payers: {[s.me]: ''}}
    const pay = (total: string) => ({payers: {[s.me]: total}, total})
    await s.createExpense({...base, ...pay('90000'), currency: 'INR', title: 'Dinner', groupId: null})
    await s.createExpense({...base, ...pay('4000'), currency: 'EUR', title: 'Museum', groupId: null})
    await s.createExpense({...base, ...pay('40000'), currency: 'INR', title: 'Cab', groupId: group })
    return {bob, cara, group}
  })
}

test('Remind from the Person page: per-currency message, share sheet, logged in Activity, never "sent"', async ({page}) => {
  await stubBrowser(page)
  await openApp(page)
  const {bob, cara} = await seed(page)

  // Nothing owed, nothing to remind about.
  await page.goto(`/people/${cara}`)
  await page.getByTestId('person-more').click()
  await expect(page.getByTestId('remind')).toHaveCount(0)
  await expect(page.getByTestId('remind-me')).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.goto(`/people/${bob}`)
  await page.getByTestId('person-more').click()
  await page.getByTestId('remind').click()
  await expect(page.getByTestId('remind-sheet')).toBeVisible()
  // Each currency on its own; ₹450 direct plus ₹200 in Goa is ₹650 owed, never added to euros.
  await expect(page.getByTestId('remind-owed-INR')).toHaveText('₹650.00')
  await expect(page.getByTestId('remind-owed-EUR')).toHaveText('€20.00')
  const message = page.getByTestId('remind-message')
  await expect(message).toContainText('Hi Bob,')
  await expect(message).toContainText('₹650.00')
  await expect(message).toContainText('€20.00')
  await expect(page.getByTestId('remind-note')).toContainText('can’t see whether the message is sent')

  // The UPI link appears once my UPI id is typed.
  await expect(message).not.toContainText('upi://')
  await page.getByTestId('remind-upi').fill('me@okaxis')
  await expect(message).toContainText('Pay by UPI to me@okaxis:')
  await expect(message).toContainText('upi://pay?pa=me%40okaxis')

  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('remind-sheet')).toBeHidden()
  const shared = await page.evaluate(() => (window as unknown as {__splitoTest?: {sharedTexts: string[]}}).__splitoTest?.sharedTexts)
  expect(shared).toHaveLength(1)
  expect(shared![0]).toContain('€20.00')
  // The toast never claims the message was sent.
  await expect(page.getByText('Splito can’t see whether it was sent.')).toBeVisible()

  await page.goto('/activity')
  await expect(page.getByTestId('activity-reminder.nudged').first()).toContainText('You reminded Bob Mehta')
  await expect(page.getByTestId('activity-reminder.nudged').first()).toContainText('€20.00')

  // A second look: the sheet remembers when I last reminded.
  await page.goto(`/people/${bob}`)
  await page.getByTestId('person-more').click()
  await page.getByTestId('remind').click()
  await expect(page.getByTestId('remind-note')).toContainText('You last reminded Bob Mehta')
})

test('Remind from group Balances: the debtor row, scoped to the group', async ({page}) => {
  await stubBrowser(page)
  await openApp(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}?tab=balances`)
  const row = page.getByTestId('group-owe-Bob Mehta-You')
  await expect(row).toContainText('₹200.00')
  await page.getByTestId('group-owe-Bob Mehta-You-more').click()
  await page.getByTestId('remind').click()
  await expect(page.getByTestId('remind-owed-INR')).toHaveText('₹200.00')
  await expect(page.getByTestId('remind-message')).toContainText('for Goa')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('remind-sheet')).toBeHidden()
  await page.goto('/activity')
  await expect(page.getByTestId('activity-reminder.nudged').first()).toContainText('Goa')
})

test('Remind from the Settle plan: only when they pay me; Remind me either way', async ({page}) => {
  await stubBrowser(page)
  await openApp(page)
  const {group} = await seed(page)
  await page.goto(`/groups/${group}/settle`)
  await page.getByTestId('transfer-more').first().click()
  await expect(page.getByTestId('remind')).toBeVisible()
  await expect(page.getByTestId('remind-me')).toBeVisible()
  await page.getByTestId('remind').click()
  await expect(page.getByTestId('remind-owed-INR')).toHaveText('₹200.00')
})

test('Remind me: primer before the permission, listed on the Person page, edited, cancelled and logged', async ({page}) => {
  await stubBrowser(page)
  await openApp(page)
  const {bob} = await seed(page)
  await page.goto(`/people/${bob}`)
  await expect(page.getByTestId('person-reminders')).toHaveCount(0)

  await page.getByTestId('person-more').click()
  await page.getByTestId('remind-me').click()
  await expect(page.getByTestId('remind-me-sheet')).toBeVisible()
  // Honest about the web: it only fires while open.
  await expect(page.getByText('On the web, Splito can only remind you while it’s open.')).toBeVisible()
  await expect(page.getByTestId('remind-next')).toBeVisible()
  // The Timezone preference is the device's, so no zone note.
  await expect(page.getByTestId('remind-zone')).toHaveCount(0)
  await page.getByTestId('remind-pick-in3days').click()

  // A time that is not real stops the save.
  await page.getByTestId('remind-time').fill('')
  await expect(page.getByTestId('remind-error')).toBeVisible()
  await page.getByTestId('remind-pick-in3days').click()
  await expect(page.getByTestId('remind-error')).toHaveCount(0)

  // The OS prompt waits for the primer, and only a tap on Allow shows it.
  expect(await page.evaluate(() => Notification.permission)).toBe('default')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('remind-primer')).toBeVisible()
  expect(await page.evaluate(() => Notification.permission)).toBe('default')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('remind-me-sheet')).toBeHidden()
  expect(await page.evaluate(() => Notification.permission)).toBe('granted')

  const list = page.getByTestId('person-reminders')
  await expect(list).toBeVisible()
  await expect(list.getByTestId('reminder-when')).toBeVisible()

  // Edit: weekly now.
  await page.getByTestId('reminder-edit').click()
  await expect(page.getByTestId('remind-me-sheet')).toContainText('Edit reminder')
  await page.getByTestId('remind-repeat-weekly').click()
  await page.getByTestId('sheet-save').click()
  await expect(list).toContainText('Every week')

  await page.goto('/activity')
  await expect(page.getByTestId('activity-reminder.set').first()).toContainText('Reminder set for Bob Mehta')

  await page.goto(`/people/${bob}`)
  await page.getByTestId('reminder-cancel').click()
  await expect(page.getByTestId('person-reminders')).toHaveCount(0)
})

test('a reminder that comes due while Splito is open shows itself, and one missed while closed shows on the next open', async ({page}) => {
  await page.clock.install({time: new Date('2026-10-27T10:00:00')})
  await stubBrowser(page, 'granted')
  await openApp(page)
  const {bob} = await seed(page)
  await page.goto(`/people/${bob}`)
  await page.getByTestId('person-more').click()
  await page.getByTestId('remind-me').click()
  await page.getByTestId('remind-pick-tomorrow').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-reminders')).toBeVisible()

  await page.clock.fastForward('26:00:00')
  await expect(page.getByText('Settle up with Bob Mehta').first()).toBeVisible()

  // One that comes due while Splito is closed shows as a banner on the next open.
  await page.getByTestId('person-more').click()
  await page.getByTestId('remind-me').click()
  await page.getByTestId('remind-pick-tomorrow').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('person-reminders')).toBeVisible()
  await page.clock.fastForward('00:01')
  await page.clock.setSystemTime(new Date('2026-10-30T12:00:00'))
  await page.reload()
  await expect(page.getByText(/^While Splito was closed: Settle up with Bob Mehta/)).toBeVisible()
})

test('Settings: Payments, Comments, Invites and Reminders; none for features that do not exist', async ({page}) => {
  await openApp(page)
  await page.goto('/settings/notifications')
  await expect(page.getByText('Reminders work now.')).toBeVisible()
  await expect(page.getByTestId('pref-notify.payment')).toContainText('adds an expense with you or records a payment to or from you')
  await expect(page.getByTestId('pref-notify.comments')).toContainText('@mentions you')
  await expect(page.getByTestId('pref-notify.expense')).toHaveCount(0)
  await expect(page.getByTestId('pref-notify.invite')).toBeVisible()
  await expect(page.getByTestId('pref-notify.reminders')).toBeVisible()
  await expect(page.getByTestId('pref-notify.recurring')).toHaveCount(0)
  await expect(page.getByTestId('pref-notify.digest')).toHaveCount(0)
  await expect(page.getByTestId('pref-notify.reminders')).toContainText('only while Splito is open')
})

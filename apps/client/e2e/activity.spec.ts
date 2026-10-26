import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Locator, type Page, test} from '@playwright/test'

const DESKTOP = {width: 1440, height: 900}
const PHONE = {width: 390, height: 844}

/* Every compiled message id, so the screen can be checked for ids shown instead of words. */
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

/** Seeds the demo (two weeks of history, some of it by friends) and opens Activity. */
async function openActivity(page: Page) {
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  await page.goto('/activity')
  await expect(screen(page).getByTestId('activity-list')).toBeVisible()
}

/* Web keeps earlier pages of the stack mounted (hidden), so scope to Activity. */
const screen = (page: Page) => page.getByTestId('screen-activity')
/* The Activity item's unread badge in the sidebar. */
const peopleBadge = (page: Page) => page.getByTestId('nav-badge-activity')
const row = (page: Page, kind: string, text: string) =>
  screen(page).getByTestId(`activity-${kind}`).filter({hasText: text})
const unreadDot = (r: Locator) => r.getByTestId('activity-unread-dot')

test('the demo history reads as a feed grouped by day, in real words', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  const headers = screen(page).getByRole('heading')
  await expect(headers.first()).toHaveText('Today')
  expect(await headers.count()).toBeGreaterThan(3)

  // An edit shows what changed and what it means for you, in colour-coded words.
  const dinner = row(page, 'expense.edited', 'Dinner at Thalassa')
  await expect(dinner).toContainText('Riya Sharma edited Dinner at Thalassa')
  await expect(dinner).toContainText(
    '₹10,000.00 → ₹12,500.00 · Goa trip · you borrowed ₹2,500.00',
  )
  await expect(dinner).toContainText(/\d+m ago|1h ago/)
  await expect(row(page, 'expense.deleted', 'Groceries')).toContainText(
    'You deleted Groceries',
  )
  await expect(row(page, 'expense.restored', 'Groceries')).toContainText(
    'You restored Groceries',
  )
  await expect(row(page, 'group.created', 'Goa trip')).toContainText(
    'You created the group Goa trip',
  )
  await expect(row(page, 'person.added', 'Riya Sharma')).toContainText(
    'You added Riya Sharma as a friend',
  )
  // Earlier days show the time of day, not "Nd ago", under their header.
  await expect(row(page, 'person.added', 'Riya Sharma')).toContainText(
    /\d{1,2}:\d{2}\s?(AM|PM)/,
  )

  const words = new Set((await screen(page).innerText()).split(/\s+/))
  expect(MESSAGE_IDS.filter(id => words.has(id))).toEqual([])
})

test('changes by friends are unread with a badge; mark all read clears them, undoes, and persists', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  await expect(
    unreadDot(row(page, 'expense.edited', 'Dinner at Thalassa')),
  ).toBeVisible()
  // Your own changes never count as unread.
  await expect(
    unreadDot(row(page, 'expense.restored', 'Groceries')),
  ).toHaveCount(0)
  const dots = screen(page).getByTestId('activity-unread-dot')
  const unread = await dots.count()
  expect(unread).toBeGreaterThan(5)
  // The Activity nav item badges the same count: unread changes by other people.
  await page.goto('/')
  await expect(peopleBadge(page)).toHaveText(String(unread))
  await page.getByTestId('tab-activity').click()
  await expect(screen(page).getByTestId('activity-list')).toBeVisible()

  await screen(page).getByTestId('activity-mark-all-read').click()
  await expect(dots).toHaveCount(0)
  // The header keeps its one action in place, disabled, so the title stays centred.
  await expect(
    screen(page).getByTestId('activity-mark-all-read'),
  ).toBeDisabled()

  await page.getByRole('button', {name: 'Undo'}).click()
  await expect(dots).toHaveCount(unread)

  await screen(page).getByTestId('activity-mark-all-read').click()
  await expect(dots).toHaveCount(0)
  await page.reload()
  await expect(screen(page).getByTestId('activity-list')).toBeVisible()
  await expect(row(page, 'expense.edited', 'Dinner at Thalassa')).toBeVisible()
  await expect(dots).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByTestId('tab-activity')).toBeVisible()
  await expect(peopleBadge(page)).toHaveCount(0)
})

test('every row pictures who made the change, never who it is about', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  const avatar = (r: Locator) => r.getByTestId('userAvatarFallback').first()
  // You added Riya and created Goa trip: your avatar ("Me"), not hers or the group's.
  await expect(avatar(row(page, 'person.added', 'Riya Sharma'))).toHaveText('M')
  await expect(avatar(row(page, 'group.created', 'Goa trip'))).toHaveText('M')
  // Riya edited the dinner: hers.
  await expect(
    avatar(row(page, 'expense.edited', 'Dinner at Thalassa')),
  ).toHaveText('RS')
})

test('"From others" leaves out your own changes', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  await expect(row(page, 'expense.restored', 'Groceries')).toBeVisible()
  await screen(page).getByTestId('activity-tabs-selector-1').click()
  await expect(row(page, 'expense.edited', 'Dinner at Thalassa')).toBeVisible()
  await expect(row(page, 'expense.restored', 'Groceries')).toHaveCount(0)
  await screen(page).getByTestId('activity-tabs-selector-0').click()
  await expect(row(page, 'expense.restored', 'Groceries')).toBeVisible()
})

test('hover shows the swipe actions as buttons: mark read toggles, delete tombstones the expense with undo', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  const movie = row(page, 'expense.created', 'Movie night')
  // The quick actions only show on hover (or keyboard focus) on desktop; the "..." is always there.
  await expect(movie.getByTestId('activity-quick-actions')).toHaveCSS(
    'opacity',
    '0',
  )
  await expect(movie.getByTestId('activity-menu')).toBeVisible()
  await movie.hover()
  await expect(movie.getByTestId('activity-quick-actions')).toHaveCSS(
    'opacity',
    '1',
  )
  // Defaults: swipe right marks read, swipe left deletes.
  await movie.getByTestId('activity-action-markRead').click()
  await expect(unreadDot(movie)).toHaveCount(0)
  await movie.hover()
  await movie.getByTestId('activity-action-markRead').click()
  await expect(unreadDot(movie)).toBeVisible()

  await movie.hover()
  await movie.getByTestId('activity-action-delete').click()
  await expect(page.getByText('Expense deleted')).toBeVisible()
  await expect(row(page, 'expense.deleted', 'Movie night')).toContainText(
    'You deleted Movie night',
  )
  // A deleted expense can't be deleted again from its older rows.
  await movie.hover()
  await expect(movie.getByTestId('activity-action-delete')).toHaveCount(0)

  await page.getByRole('button', {name: 'Undo'}).click()
  await expect(row(page, 'expense.restored', 'Movie night')).toContainText(
    'You restored Movie night',
  )
})

test('hide works from the keyboard, offers undo, and hidden rows come back from the footer', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  const coffee = row(page, 'expense.created', 'Coffee beans')
  // Keyboard only: Tab from the row reveals its buttons; the menu opens with Enter and walks with arrows.
  await coffee.getByRole('link').focus()
  await page.keyboard.press('Tab')
  await expect(coffee.getByTestId('activity-action-markRead')).toBeFocused()
  await expect(coffee.getByTestId('activity-actions')).toHaveCSS('opacity', '1')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(coffee.getByTestId('activity-menu')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('activity-menu-markRead')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('activity-menu-hide')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(coffee).toHaveCount(0)
  await expect(
    page.getByText('Hidden from your activity', {exact: true}),
  ).toBeVisible()
  await expect(screen(page).getByTestId('activity-hidden-footer')).toHaveText(
    /1 change hidden from your activity/,
  )

  await page.getByRole('button', {name: 'Undo'}).click()
  await expect(coffee).toBeVisible()
  await expect(screen(page).getByTestId('activity-hidden-footer')).toHaveCount(
    0,
  )

  await coffee.hover()
  await coffee.getByTestId('activity-menu').click()
  await page.getByTestId('activity-menu-hide').click()
  await expect(coffee).toHaveCount(0)
  // Hiding is personal: the audit history still has the expense.
  await page.goto('/')
  await page.goto('/activity')
  await expect(screen(page).getByTestId('activity-hidden-footer')).toBeVisible()
  await screen(page).getByTestId('activity-unhide-all').click()
  await expect(coffee).toBeVisible()
})

test('the swipe preferences pick the row buttons', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as any).splito
    await s.setPref('swipeLeft', 'hide')
    await s.setPref('swipeRight', 'none')
  })
  const dinner = row(page, 'expense.edited', 'Dinner at Thalassa')
  await dinner.hover()
  await expect(dinner.getByTestId('activity-action-hide')).toBeVisible()
  await expect(dinner.getByTestId('activity-action-markRead')).toHaveCount(0)
  await expect(dinner.getByTestId('activity-action-delete')).toHaveCount(0)
})

test('a row opens what it is about and becomes read', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await openActivity(page)
  await row(page, 'expense.edited', 'Dinner at Thalassa')
    .getByText('Riya Sharma edited')
    .click()
  await expect(page).toHaveURL(/\/expense\/[^/]+$/)
  await expect(page.getByTestId('screen-expense')).toBeVisible()
  await page.goBack()
  await expect(
    unreadDot(row(page, 'expense.edited', 'Dinner at Thalassa')),
  ).toHaveCount(0)

  await row(page, 'group.created', 'Goa trip')
    .getByText('created the group')
    .click()
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await page.goBack()
  await row(page, 'person.added', 'Priya Nair').getByText('as a friend').click()
  await expect(page.getByTestId('screen-person')).toBeVisible()
})

test('phones: the menu button is always there, the FAB and the tab badge show', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openActivity(page)
  await expect(
    row(page, 'expense.edited', 'Dinner at Thalassa').getByTestId(
      'activity-menu',
    ),
  ).toBeVisible()
  await expect(
    row(page, 'expense.edited', 'Dinner at Thalassa').getByTestId(
      'activity-action-markRead',
    ),
  ).toHaveCount(0)
  await expect(screen(page).getByTestId('fab-add')).toBeVisible()
  // A tab: no Back, the avatar at the top right, and the unread badge on the bottom bar's Activity tab.
  await expect(screen(page).getByLabel('Go back')).toHaveCount(0)
  await expect(screen(page).getByTestId('header-avatar')).toBeVisible()
  await page.goto('/')
  await expect(peopleBadge(page)).toContainText(/\d+/)
})

test('an empty store shows the illustrated empty state; the old /notifications link still lands', async ({
  page,
}) => {
  await page.goto('/notifications')
  await expect(page.getByTestId('screen-activity')).toBeVisible()
  await expect(page.getByTestId('activity-empty')).toBeVisible()
  await expect(page.getByTestId('activity-empty')).toContainText(
    'Nothing here yet',
  )
})

import {expect, type Page, test} from '@playwright/test'

import {type SplitoDevTools} from '../src/data/devTools'
import {openApp} from './app'
import {DESKTOP, PHONE} from './viewports'

/*
 * F-1204: comments on expenses and payments. One timeline under the expense (comments
 * and edit-history lines in time order under date dividers), a Bluesky DM composer,
 * @mention of the participants, edit and delete of my own comments only, a count on rows.
 */

async function seed(page: Page) {
  await openApp(page)
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: SplitoDevTools}).splito
    const friend = await s.createPerson('Kavya Rao')
    const expense = await s.createExpense({
      title: 'Concert',
      groupId: null,
      currency: 'INR',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
      total: '20000',
      payers: {[s.me]: '20000'},
      split: {mode: 'equal', participants: [s.me, friend]},
      date: '2026-10-20',
    })
    const payment = await s.createRepayment({
      groupId: null,
      currency: 'INR',
      from: friend,
      to: s.me,
      amount: '5000',
      date: '2026-10-21',
      tz: 'Asia/Kolkata',
      note: '',
    })
    return {friend, expense, payment}
  })
}

const send = async (page: Page, text: string) => {
  await page.getByTestId('comment-input').fill(text)
  await page.getByTestId('comment-input').press('Enter')
}

test('add a comment: it joins the timeline after the history line, under a date divider, and the count shows on the row', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  const {friend, expense} = await seed(page)
  await page.goto(`/expense/${expense}`)
  await expect(page.getByTestId('discussion-empty')).toBeVisible()
  await expect(page.getByTestId('comment-send')).toBeDisabled()

  await send(page, 'Who has the tickets?')
  const bubble = page
    .getByTestId('comment-bubble')
    .filter({hasText: 'Who has the tickets?'})
  await expect(bubble).toBeVisible()
  await expect(page.getByTestId('discussion-empty')).toHaveCount(0)
  await expect(page.getByTestId('comment-input')).toHaveValue('')

  // One timeline in time order: the "added" line, then the comment.
  const order = await page
    .getByTestId('discussion')
    .evaluate(el =>
      [
        ...el.querySelectorAll(
          '[data-testid="history-created"], [data-testid="comment-bubble"]',
        ),
      ].map(n => n.getAttribute('data-testid')),
    )
  expect(order).toEqual(['history-created', 'comment-bubble'])
  await expect(page.getByTestId('comment-date-divider').first()).toContainText(
    'Today at',
  )
  await expect(page.getByTestId('comment-meta')).toBeVisible()

  // It survives a reload (it is in the local database), and the person's page shows the count.
  await page.reload()
  await expect(
    page
      .getByTestId('comment-bubble')
      .filter({hasText: 'Who has the tickets?'}),
  ).toBeVisible()
  await page.goto(`/people/${friend}`)
  await expect(page.getByTestId(`comment-count-${expense}`)).toHaveText('1')
})

test('edit with Up arrow, cancel with Escape, delete with confirmation; only my own comments', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  const {friend, expense} = await seed(page)
  await page.evaluate(
    ([f, e]) =>
      (window as unknown as {splito: SplitoDevTools}).splito.commentAs(f!, {
        targetType: 'expense',
        targetId: e!,
        body: 'I bought them',
      }),
    [friend, expense],
  )
  await page.goto(`/expense/${expense}`)
  await send(page, 'Thanks!')
  await expect(
    page.getByTestId('comment-bubble').filter({hasText: 'Thanks!'}),
  ).toBeVisible()

  // Up in the empty composer edits my last comment; Escape cancels and clears.
  await page.getByTestId('comment-input').press('ArrowUp')
  await expect(page.getByTestId('comment-editing')).toBeVisible()
  await expect(page.getByTestId('comment-input')).toHaveValue('Thanks!')
  await page.getByTestId('comment-input').press('Escape')
  await expect(page.getByTestId('comment-editing')).toHaveCount(0)
  await expect(page.getByTestId('comment-input')).toHaveValue('')

  // Edit and save: the text changes and the row says Edited.
  await page.getByTestId('comment-input').press('ArrowUp')
  await page.getByTestId('comment-input').fill('Thanks a lot!')
  await page.getByTestId('comment-input').press('Enter')
  const mine = page
    .getByTestId('comment-bubble')
    .filter({hasText: 'Thanks a lot!'})
  await expect(mine).toBeVisible()
  await expect(page.getByTestId('comment-editing')).toHaveCount(0)
  await expect(
    page.getByTestId('comment-meta').filter({hasText: 'Edited'}),
  ).toBeVisible()

  // Someone else's comment: Copy text and Copy link only.
  const theirs = page
    .getByTestId('comment-bubble')
    .filter({hasText: 'I bought them'})
  await theirs.click({button: 'right'})
  await expect(page.getByTestId('comment-copy')).toBeVisible()
  await expect(page.getByTestId('comment-copy-link')).toBeVisible()
  await expect(page.getByTestId('comment-edit')).toHaveCount(0)
  await expect(page.getByTestId('comment-delete')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // My comment: all four, reachable from the "..." button with the keyboard too.
  await mine.click({button: 'right'})
  await expect(page.getByTestId('comment-edit')).toBeVisible()
  await expect(page.getByTestId('comment-delete')).toBeVisible()
  await page.getByTestId('comment-delete').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByText('This comment was deleted')).toBeVisible()
  await expect(
    page.getByTestId('comment-bubble').filter({hasText: 'Thanks a lot!'}),
  ).toHaveCount(0)
})

test('@ lists the expense participants; choosing one tags them in the sent comment', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  const {expense} = await seed(page)
  await page.goto(`/expense/${expense}`)
  await page.getByTestId('comment-input').pressSequentially('Hey @ka')
  await expect(page.getByTestId('mention-list')).toBeVisible()
  await expect(page.getByTestId('mention-option-Kavya Rao')).toBeVisible()
  await page.getByTestId('comment-input').press('Enter')
  await expect(page.getByTestId('comment-input')).toHaveValue('Hey @Kavya Rao ')
  await page.getByTestId('comment-input').press('Enter')
  await expect(page.getByTestId('comment-mention')).toHaveText('@Kavya Rao')
})

test('the edit history always shows between the comments (F-251: no switch)', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  const {expense} = await seed(page)
  await page.goto(`/expense/${expense}`)
  await send(page, 'A note')
  await expect(page.getByTestId('history-created')).toBeVisible()
  await expect(
    page.getByTestId('comment-bubble').filter({hasText: 'A note'}),
  ).toBeVisible()
})

test('phone: the composer bar is pinned under the page, the send button adds, long-press opens the drawer menu', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  const {expense} = await seed(page)
  await page.goto(`/expense/${expense}`)
  const input = page.getByTestId('comment-input')
  await expect(input).toBeVisible()
  const box = await input.boundingBox()
  expect(box!.y + box!.height).toBeGreaterThan(PHONE.height - 120)
  await input.fill('From my phone 🎉')
  await page.getByTestId('comment-send').click()
  const bubble = page
    .getByTestId('comment-bubble')
    .filter({hasText: 'From my phone'})
  await expect(bubble).toBeVisible()
  await bubble.click({delay: 700})
  await expect(page.getByTestId('comment-edit')).toBeVisible()
  await expect(page.getByTestId('comment-delete')).toBeVisible()
  await context.close()
})

test('desktop: Tab from a bubble lands on its "..." button and Enter opens the menu', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  const {friend, expense} = await seed(page)
  await page.evaluate(
    ([f, e]) =>
      (window as unknown as {splito: SplitoDevTools}).splito.commentAs(f!, {
        targetType: 'expense',
        targetId: e!,
        body: 'Keyboard only',
      }),
    [friend, expense],
  )
  await page.goto(`/expense/${expense}`)
  const bubble = page
    .getByTestId('comment-bubble')
    .filter({hasText: 'Keyboard only'})
  await bubble.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('comment-menu')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('comment-copy')).toBeVisible()
  await expect(page.getByTestId('comment-copy-link')).toBeVisible()
})

test('phone: Shift+F10 and the ContextMenu key on a focused bubble open the menu', async ({
  browser,
}) => {
  const context = await browser.newContext({viewport: PHONE})
  const page = await context.newPage()
  const {expense} = await seed(page)
  await page.goto(`/expense/${expense}`)
  await send(page, 'Mine, phone width')
  const bubble = page
    .getByTestId('comment-bubble')
    .filter({hasText: 'Mine, phone width'})
  await expect(bubble).toBeVisible()
  // No "..." button at this width; the keyboard's context-menu keys are the way in.
  await expect(page.getByTestId('comment-menu')).toHaveCount(0)
  for (const key of ['Shift+F10', 'ContextMenu']) {
    await bubble.focus()
    await page.keyboard.press(key)
    await expect(page.getByTestId('comment-edit')).toBeVisible()
    await expect(page.getByTestId('comment-delete')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('comment-edit')).toHaveCount(0)
  }
  await context.close()
})

test('a payment has its own page and thread, reached from its details', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  const {friend, payment} = await seed(page)
  await page.goto(`/people/${friend}`)
  await page.getByTestId(`history-${payment}`).click()
  await page.getByTestId('payment-discussion').click()
  await expect(page.getByTestId('screen-repayment')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/payment/${payment}$`))
  await expect(page.getByTestId('repayment-detail-amount')).toHaveText('₹50.00')
  await send(page, 'Received, thanks')
  await expect(
    page.getByTestId('comment-bubble').filter({hasText: 'Received, thanks'}),
  ).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId(`comment-count-${payment}`)).toHaveText('1')
})

import {expect, type Page, test} from '@playwright/test'

import {openApp} from './app'
import {openDemo} from './openDemo'
import {seedGroup} from './seed'
import {PHONE} from './viewports'

/* F-116: web navigation and sheet robustness (audit M16, m26, m27). */

async function seed(page: Page) {
  const {group, expenses} = await seedGroup(page, {
    people: ['Bela Joshi'],
    expenses: [{title: 'Rafting', total: '10000', paidBy: 0, among: [0, 1], date: '2026-09-05', category: 'entertainment'}],
  })
  return {group, expense: expenses[0]!}
}

test('M16: Back after a deep link or refresh goes to the page above, not People', async ({
  page,
}) => {
  await openApp(page)
  const {group, expense} = await seed(page)

  // /groups/:id/settle -> Group -> Groups
  await page.goto(`/groups/${group}/settle`)
  await expect(page.getByTestId('screen-settle')).toBeVisible()
  await page.getByTestId('header-back').click()
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/groups/${group}$`))
  await page.getByTestId('header-back').click()
  await expect(page.getByTestId('screen-groups')).toBeVisible()

  // /expense/:id/edit -> Expense
  await page.goto(`/expense/${expense}/edit`)
  await expect(page.getByTestId('screen-edit-expense')).toBeVisible()
  await page.getByTestId('sheet-close').click()
  await expect(page.getByTestId('screen-expense')).toBeVisible()
})

test('m26: reopening a phone drawer during its exit leaves it on screen', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/people')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  const people = page.getByTestId('screen-people')
  await people.getByTestId('list-filters').click()
  const sheet = page.getByTestId('friends-filters-sheet')
  await expect(sheet).toBeVisible()
  await page.waitForTimeout(600)
  // Close, and press the opener again 80 ms later: inside the 200 ms exit.
  await page.evaluate(() => {
    const click = (id: string) =>
      (
        document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
      )?.click()
    click('sheet-cancel')
    setTimeout(() => click('list-filters'), 80)
  })
  await page.waitForTimeout(900)
  await expect(sheet).toBeVisible()
  const box = (await sheet.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(844 + 1)
  expect(box.y).toBeLessThan(844 - 100)
})

test('m27: browser Back on a dirty Add friend sheet asks "Discard changes?"', async ({
  page,
}) => {
  await openApp(page)
  await page.goto('/people')
  await page.getByTestId('people-add-friend').click()
  await expect(page.getByTestId('screen-add-friend')).toBeVisible()
  await page.getByTestId('add-friend-name').fill('Zoe Hart')

  await page.goBack()
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await expect(page.getByTestId('screen-add-friend')).toBeVisible()
  await page.getByRole('button', {name: 'Keep editing'}).click()
  await expect(page.getByTestId('add-friend-name')).toHaveValue('Zoe Hart')

  // The cross asks the same, and Discard leaves.
  await page.getByTestId('sheet-close').click()
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('screen-add-friend')).toHaveCount(0)
  await expect(page.getByTestId('screen-people')).toBeVisible()
})

test('m30d: Enter twice in "Add someone new" makes one friend', async ({
  page,
}) => {
  await openApp(page)
  await page.goto('/groups/new')
  const input = page.getByTestId('create-group-new-member')
  await input.fill('Dup Dev')
  await input.evaluate(el => {
    for (let i = 0; i < 2; i++)
      el.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}),
      )
  })
  await expect(page.getByTestId('create-group-member-Dup Dev')).toHaveCount(1)
  await page.waitForTimeout(500)
  await expect(page.getByTestId('create-group-member-Dup Dev')).toHaveCount(1)
})

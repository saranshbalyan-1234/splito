import {expect, test} from '@playwright/test'

import {activityRows} from './activity'
import {openApp} from './app'
import {composeButton} from './composer'
import {DESKTOP, PHONE} from './viewports'

/*
 * Owner 230: Splito works as an expense tracker too. A new account with no friends adds an expense just for
 * itself: the composer says so, it saves, it moves no balance (People stays empty), and Activity, the expense page
 * and Analytics count it as my own spending.
 */
for (const size of [PHONE, DESKTOP]) {
  test(`a personal expense, with no friends at all, at ${size.width} px`, async ({page}) => {
    await page.setViewportSize(size)
    await openApp(page, '/people')
    const people = page.getByTestId('screen-people')
    await expect(people).toContainText('add an expense just for you')

    await composeButton(page, 'screen-people').click()
    const sheet = page.getByTestId('screen-add-expense')
    await expect(sheet).toBeVisible()
    await expect(page.getByTestId('expense-people')).toContainText('You')
    await expect(page.getByTestId('expense-payers')).toContainText('You')
    await page.getByTestId('expense-title').fill('Coffee')
    await page.getByTestId('amount-input').fill('120')
    await expect(sheet).toContainText('Just you · a personal expense')
    await page.getByTestId('sheet-save').click()
    await expect(sheet).toHaveCount(0)

    /* No balance with anyone: People still has nothing to show. */
    await expect(people).toContainText('No friends yet')

    await page.goto('/activity/me')
    const row = activityRows(page).filter({hasText: 'Coffee'})
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('personal')
    await expect(row).not.toContainText('not involved')
    await row.click()
    await expect(page.getByTestId('screen-expense').last()).toContainText('Personal expense, just you')

    await page.goto('/analytics')
    const analytics = page.getByTestId('screen-analytics')
    await expect(analytics).toContainText('Your share of expenses')
    await expect(analytics).toContainText('₹120.00')
  })
}

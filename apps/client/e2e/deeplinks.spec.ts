import {expect, test} from '@playwright/test'

import {openDemo} from './openDemo'

test('smoke: a sheet pushes its url and Back closes it', async ({page}) => {
  await openDemo(page, '/groups')
  await expect(page.getByTestId('screen-groups')).toBeVisible()
  await page.getByTestId('screen-groups').getByTestId('list-filters').click()
  await expect(page.getByTestId('groups-filters-sheet')).toBeVisible()
  await expect(page).toHaveURL(/\/groups\/filters$/)
  await page.goBack()
  await expect(page.getByTestId('groups-filters-sheet')).toBeHidden()
  await expect(page).toHaveURL(/\/groups$/)
  await page.goForward()
  await expect(page.getByTestId('groups-filters-sheet')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('groups-filters-sheet')).toBeVisible()
  await page.getByTestId('sheet-close').click()
  await expect(page).toHaveURL(/\/groups$/)
})

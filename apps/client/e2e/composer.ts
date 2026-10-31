import {expect, type Page} from '@playwright/test'

import {openDemo} from './openDemo'

/**
 * The compose action: the FAB on phones, the sidebar pill on wide screens (owner 190). On a phone (ignored on wide screens), pass the
 * screen's testID when pages are stacked: every kept screen has its own FAB, only the top one is visible.
 */
export function composeButton(page: Page, screen?: string) {
  const isPhone = (page.viewportSize()?.width ?? 0) < 600
  const scope = screen && isPhone ? page.getByTestId(screen) : page
  return scope.getByTestId(isPhone ? 'fab-add' : 'sidebar-add').first()
}

/** Sizes the page, opens the demo People list and Add expense from the compose action. */
export async function openAddExpense(page: Page, size: {width: number; height: number}) {
  await page.setViewportSize(size)
  await openDemo(page, '/people')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await composeButton(page).click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
}

/** Opens the composer's people picker, taps each name, and closes it (the split is then with those people). */
export async function pickPeople(page: Page, names: string[]) {
  await page.getByTestId('expense-people').click()
  for (const name of names) await page.getByTestId(`person-option-${name}`).click()
  await page.getByTestId('people-dialog').getByTestId('sheet-close').click()
  await expect(page.getByTestId('people-dialog')).toHaveCount(0)
}

/** Opens the "More options" part of the composer (how to split, cash rounding, notes) when it is closed. */
export async function openMoreOptions(page: Page) {
  if ((await page.getByTestId('expense-more-options').count()) === 0)
    await page.getByTestId('expense-more').click()
  await expect(page.getByTestId('expense-more-options')).toBeVisible()
}

/** Picks how the expense is split (the chips live under "More options"). */
export async function chooseSplitMode(
  page: Page,
  mode: 'equal' | 'exact' | 'percent' | 'shares' | 'adjusted' | 'items',
) {
  await openMoreOptions(page)
  await page.getByTestId(`split-mode-${mode}`).click()
}

/** Opens the itemize bill's "Tax, tip and discounts" row when it is closed. */
export async function openCharges(page: Page) {
  if ((await page.getByTestId('item-charges').count()) === 0)
    await page.getByTestId('item-charges-row').click()
  await expect(page.getByTestId('item-charges')).toBeVisible()
}

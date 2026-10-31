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

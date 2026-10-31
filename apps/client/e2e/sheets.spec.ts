import {expect, type Page, test} from '@playwright/test'

import {composeButton} from './composer'
import {openDemo as enterDemo} from './openDemo'
import {DESKTOP, PHONE} from './viewports'

/*
 * Owner rule 7: every form sheet shares one layout. Phones: a sheet from the
 * bottom edge, title left, round cross top right, Cancel and the primary
 * action side by side filling the width. Web: a centred popup with Cancel
 * then Save at its bottom right. Unsaved changes ask "Discard changes?";
 * pickers close with the cross alone.
 */


async function openDemo(page: Page, path = '/people') {
  await enterDemo(page, path)
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
}

async function openFilters(page: Page) {
  await page.getByTestId('screen-people').getByTestId('list-filters').click()
  const sheet = page.getByTestId('friends-filters-sheet')
  await expect(sheet).toBeVisible()
  /* The popup zooms in and the phone sheet slides up; measure once it has settled. */
  await page.waitForTimeout(500)
  return sheet
}

async function boxOf(page: Page, testID: string) {
  return (await page.getByTestId(testID).boundingBox())!
}

test('the cross closes a sheet, and so does Cancel', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page)
  let sheet = await openFilters(page)
  await expect(sheet.getByTestId('sheet-close')).toHaveAttribute(
    'aria-label',
    'Close',
  )
  await sheet.getByTestId('sheet-close').click()
  await expect(sheet).toHaveCount(0)

  sheet = await openFilters(page)
  await sheet.getByTestId('sheet-cancel').click()
  await expect(sheet).toHaveCount(0)
})

test('closing with unsaved changes asks "Discard changes?" from the cross, Cancel, Escape and the scrim', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page)
  const sheet = await openFilters(page)
  await page.getByTestId('filter-show-youOwe').click()

  // The cross: Keep editing returns to the sheet with the change intact.
  await sheet.getByTestId('sheet-close').click()
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await page.getByRole('button', {name: 'Keep editing'}).click()
  await expect(page.getByText('Discard changes?')).toHaveCount(0)
  await expect(sheet).toBeVisible()
  await expect(page.getByTestId('filter-show-youOwe')).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // Escape asks too.
  await page.keyboard.press('Escape')
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await page.getByRole('button', {name: 'Keep editing'}).click()
  await expect(page.getByText('Discard changes?')).toHaveCount(0)
  await expect(sheet).toBeVisible()

  // So does a click on the scrim, away from the popup.
  await page.mouse.click(40, DESKTOP.height - 40)
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await page.getByRole('button', {name: 'Keep editing'}).click()
  await expect(page.getByText('Discard changes?')).toHaveCount(0)

  // Cancel, then Discard: the sheet closes and nothing was applied.
  await sheet.getByTestId('sheet-cancel').click()
  await page.getByTestId('confirmBtn').click()
  await expect(sheet).toHaveCount(0)
  await expect(
    page.getByTestId('screen-people').getByTestId('person-Arjun Mehta'),
  ).toBeVisible()
  await expect(page.getByTestId('list-filters-dot')).toHaveCount(0)
})

test('Save stays off until the form is valid', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/friends/new')
  const save = page.getByTestId('sheet-save')
  await expect(save).toBeDisabled()
  await page.getByTestId('add-friend-name').fill('  ')
  await expect(save).toBeDisabled()
  await page.getByTestId('add-friend-name').fill('Nikhil Das')
  await expect(save).toBeEnabled()
  // A typed form asks before it closes.
  await page.getByTestId('sheet-close').click()
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('screen-add-friend')).toHaveCount(0)
})

test('web: a centred popup with the cross at the top right and Cancel then Save at the bottom right', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page)
  await openFilters(page)
  const sheet = await boxOf(page, 'friends-filters-sheet')
  const close = await boxOf(page, 'sheet-close')
  const cancel = await boxOf(page, 'sheet-cancel')
  const save = await boxOf(page, 'sheet-save')

  // Centred in the window, and no wider than Bluesky's dialog.
  expect(Math.abs(sheet.x + sheet.width / 2 - DESKTOP.width / 2)).toBeLessThan(
    2,
  )
  expect(
    Math.abs(sheet.y + sheet.height / 2 - DESKTOP.height / 2),
  ).toBeLessThan(24)
  expect(sheet.width).toBeLessThanOrEqual(600)
  // The cross at the top right.
  expect(close.x + close.width).toBeGreaterThan(sheet.x + sheet.width - 32)
  expect(close.y).toBeLessThan(sheet.y + 24)
  // Cancel then Save, side by side at the bottom right.
  expect(save.x + save.width).toBeGreaterThan(sheet.x + sheet.width - 32)
  expect(save.y + save.height).toBeGreaterThan(sheet.y + sheet.height - 32)
  expect(cancel.x + cancel.width).toBeLessThan(save.x)
  expect(Math.abs(cancel.y - save.y)).toBeLessThan(2)
  expect(cancel.x).toBeGreaterThan(sheet.x + sheet.width / 2)
})

test('phones: a sheet from the bottom edge with Cancel and Save sharing the width', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await openFilters(page)
  const sheet = await boxOf(page, 'friends-filters-sheet')
  const close = await boxOf(page, 'sheet-close')
  const cancel = await boxOf(page, 'sheet-cancel')
  const save = await boxOf(page, 'sheet-save')

  expect(sheet.width).toBe(PHONE.width)
  expect(Math.round(sheet.y + sheet.height)).toBe(PHONE.height)
  expect(close.x + close.width).toBeGreaterThan(PHONE.width - 32)
  // Two equal buttons filling the width, Cancel on the left.
  expect(cancel.x).toBeLessThan(32)
  expect(save.x + save.width).toBeGreaterThan(PHONE.width - 32)
  expect(Math.abs(cancel.width - save.width)).toBeLessThan(2)
  expect(cancel.x + cancel.width).toBeLessThan(save.x)
})

test('pickers close with the cross alone and apply the choice at once', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page)
  await composeButton(page).click()
  await page.getByTestId('amount-currency').click()
  const picker = page.getByTestId('currency-dialog')
  await expect(picker.getByTestId('sheet-close')).toBeVisible()
  await expect(picker.getByTestId('sheet-save')).toHaveCount(0)
  await expect(picker.getByTestId('sheet-cancel')).toHaveCount(0)
  await page.getByTestId('currency-dialog-EUR').click()
  await expect(picker).toHaveCount(0)
  await expect(page.getByTestId('amount-currency')).toContainText('EUR')

  await page.getByTestId('expense-date').click()
  const date = page.getByTestId('date-dialog')
  await expect(date.getByTestId('sheet-save')).toHaveCount(0)
  await date.getByTestId('sheet-close').click()
  await expect(date).toHaveCount(0)
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
})

test('Add expense: the readout sits just above Cancel and Save expense; no Cancel or Save in the top bar', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await composeButton(page).click()
  const composer = page.getByTestId('screen-add-expense')
  await expect(
    composer.getByRole('heading', {name: 'Add expense'}),
  ).toBeVisible()
  await expect(page.getByTestId('sheet-save')).toHaveText('Save expense')
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('amount-input').fill('90')
  /* Measure once the sheet has finished rising. */
  await page.waitForTimeout(500)
  const readout = (await page.getByTestId('split-readout').boundingBox())!
  const save = await boxOf(page, 'sheet-save')
  const close = await boxOf(page, 'sheet-close')
  expect(readout.y + readout.height).toBeLessThanOrEqual(save.y)
  expect(save.y - (readout.y + readout.height)).toBeLessThan(40)
  // The top bar holds the title and the cross only.
  expect(close.y).toBeLessThan(readout.y)
  await expect(composer.getByRole('button', {name: 'Cancel'})).toHaveCount(1)
})

test('the top bar shows its hairline only while the form is scrolled under it', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await composeButton(page).click()
  const header = page
    .getByTestId('screen-add-expense')
    .getByTestId('sheet-header')
  const borderColor = () =>
    header.evaluate(el => getComputedStyle(el).borderBottomColor)
  await expect.poll(borderColor).toBe('rgba(0, 0, 0, 0)')
  // Itemize makes the form taller than the sheet; a wheel over the form scrolls it.
  await page.getByTestId('split-mode-items').click()
  await page.getByTestId('expense-form').hover()
  await page.mouse.wheel(0, 200)
  await expect.poll(borderColor).not.toBe('rgba(0, 0, 0, 0)')
  await page.getByTestId('expense-form').evaluate(el => el.scrollTo(0, 0))
  await expect.poll(borderColor).toBe('rgba(0, 0, 0, 0)')
})

test('Edit group: the overflow opens it, Save waits for a change, and the page follows', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await openDemo(page)
  await page.goto('/groups')
  await page.getByTestId('group-Lisbon').click()
  await expect(page.getByTestId('group-name')).toHaveText(/^Lisbon( - Demo)?$/)
  await page.getByTestId('group-more').click()
  await page.getByTestId('group-menu-edit').click()
  const sheet = page.getByTestId('edit-group-sheet')
  await expect(sheet.getByRole('heading', {name: 'Edit group'})).toBeVisible()
  await expect(page.getByTestId('edit-group-name')).toHaveValue('Lisbon')
  await expect(sheet.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('edit-group-name').fill('Lisbon & Porto')
  await sheet.getByTestId('sheet-save').click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByTestId('group-name')).toHaveText(/^Lisbon & Porto( - Demo)?$/)
})

import {expect, type Page, test} from '@playwright/test'

const DESKTOP = {width: 1440, height: 900}
const PHONE = {width: 390, height: 844}

async function openAddExpense(page: Page) {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
}

async function splitWith(page: Page, names: string[]) {
  await page.getByTestId('expense-people').click()
  for (const name of names) await page.getByTestId(`person-option-${name}`).click()
  await page.getByTestId('people-done').click()
  await expect(page.getByTestId('people-dialog')).toHaveCount(0)
}

/** Saves, waits for the success check, and opens the new expense from the toast. Returns its id. */
async function saveAndView(page: Page) {
  await page.getByTestId('composer-save').click()
  await expect(page.getByTestId('expense-saved')).toBeVisible()
  await page.getByRole('button', {name: 'View expense'}).click()
  await expect(page.getByTestId('screen-expense')).toBeVisible()
  return new URL(page.url()).pathname.split('/').pop()!
}

test('add an expense: category suggestion, calculator, exact split readout, save, detail and history', async ({page}) => {
  await openAddExpense(page)
  const save = page.getByTestId('composer-save')
  await expect(save).toBeDisabled()

  await page.getByTestId('expense-title').fill('Dinner at Thalassa')
  await expect(page.getByTestId('expense-category-name')).toContainText('Food')

  await page.getByTestId('amount-input').fill('1200+300')
  await expect(page.getByTestId('amount-result')).toHaveText('= ₹1,500.00')
  await expect(save).toBeEnabled()

  await splitWith(page, ['Riya Sharma', 'Sam Carter'])
  await expect(page.getByTestId('split-readout')).toContainText('₹500.00 each · 3 people')

  await page.getByTestId('split-mode-exact').click()
  await page.getByTestId('split-exact-You').fill('700')
  await page.getByTestId('split-exact-Riya Sharma').fill('500')
  await expect(page.getByTestId('split-readout')).toHaveText('₹300.00 left to assign')
  await expect(save).toBeDisabled()
  await page.getByTestId('split-exact-Sam Carter').fill('300')
  await expect(page.getByTestId('split-readout')).toHaveText('All ₹1,500.00 assigned')
  await expect(save).toBeEnabled()

  await saveAndView(page)
  await expect(page.getByTestId('expense-detail-title')).toHaveText('Dinner at Thalassa')
  await expect(page.getByTestId('expense-detail-amount')).toHaveText('₹1,500.00')
  await expect(page.getByTestId('share-row-Riya Sharma')).toContainText('₹500.00')
  await expect(page.getByTestId('expense-my-net')).toContainText('You lent ₹800.00')
  await expect(page.getByTestId('history-created')).toContainText('You added this expense')
})

test('amount errors read in plain words', async ({page}) => {
  await openAddExpense(page)
  const amount = page.getByTestId('amount-input')
  await amount.fill('10/0')
  await page.getByTestId('expense-title').click()
  await expect(page.getByTestId('amount-error')).toHaveText('You can’t divide by zero')
  await amount.fill('12.345')
  await page.getByTestId('expense-title').click()
  await expect(page.getByTestId('amount-error')).toContainText('Too many digits after the decimal point')
  await amount.fill('abc')
  await page.getByTestId('expense-title').click()
  await expect(page.getByTestId('amount-error')).toContainText('isn’t a number')
  await expect(page.getByTestId('composer-save')).toBeDisabled()
})

test('a group expense uses the group members and currency; multiple payers must add up', async ({page}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-group').click()
  await page.getByTestId('group-option-Lisbon').click()
  await expect(page.getByTestId('expense-group-value')).toHaveText('Lisbon')
  await expect(page.getByTestId('amount-currency')).toContainText('EUR')
  await page.getByTestId('expense-title').fill('Tram tickets')
  await page.getByTestId('amount-input').fill('40')
  await expect(page.getByTestId('split-readout')).toContainText('€10.00 each · 4 people')

  await page.getByTestId('expense-payers').click()
  await page.getByTestId('payers-multiple').click()
  await page.getByTestId('paid-You').fill('25')
  await expect(page.getByTestId('payers-readout')).toContainText('€15.00 left to pay')
  await page.getByTestId('paid-Lena Fischer').fill('15')
  await expect(page.getByTestId('payers-readout')).toHaveText('Adds up to the total')
  await page.getByTestId('payers-done').click()
  await expect(page.getByTestId('expense-payers-value')).toHaveText('2 people')

  await page.getByTestId('split-mode-percent').click()
  for (const name of ['You', 'Sam Carter', 'Lena Fischer']) await page.getByTestId(`split-percent-${name}`).fill('25')
  await expect(page.getByTestId('split-readout')).toHaveText('25% left to assign')
  await page.getByTestId('split-percent-Diego Alves').fill('25')
  await expect(page.getByTestId('split-readout')).toHaveText('100% assigned')

  await saveAndView(page)
  await expect(page.getByTestId('expense-detail-amount')).toHaveText('€40.00')
  await expect(page.getByTestId('expense-group-link')).toContainText('Lisbon')
  await expect(page.getByTestId('paid-row-Lena Fischer')).toContainText('€15.00')
})

test('itemised split with tax, shares and equal-with-adjustments', async ({page}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-title').fill('Pizza night')
  await page.getByTestId('amount-input').fill('330')
  await splitWith(page, ['Riya Sharma'])

  await page.getByTestId('split-mode-shares').click()
  await page.getByTestId('split-shares-You-plus').click()
  await expect(page.getByTestId('share-You')).toHaveText('₹220.00')

  await page.getByTestId('split-mode-adjusted').click()
  await page.getByTestId('split-adjust-Riya Sharma').fill('30')
  await expect(page.getByTestId('share-Riya Sharma')).toHaveText('₹180.00')

  await page.getByTestId('split-mode-items').click()
  await page.getByTestId('item-add').click()
  await page.getByTestId('item-0-name').fill('Margherita')
  await page.getByTestId('item-0-amount').fill('200')
  await page.getByTestId('item-add').click()
  await page.getByTestId('item-1-name').fill('Garlic bread')
  await page.getByTestId('item-1-amount').fill('100')
  await page.getByTestId('item-1-person-You').click()
  await page.getByTestId('item-tax').fill('30')
  await expect(page.getByTestId('split-readout')).toHaveText('All ₹330.00 assigned')

  await saveAndView(page)
  await expect(page.getByTestId('share-row-Riya Sharma')).toContainText('₹220.00')
  await expect(page.getByTestId('screen-expense')).toContainText('Garlic bread')
})

test('edit, then delete with undo', async ({page}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-title').fill('Cab to airport')
  await page.getByTestId('amount-input').fill('600')
  const id = await saveAndView(page)

  await page.getByTestId('expense-menu').click()
  await page.getByTestId('expense-edit').click()
  await expect(page.getByTestId('screen-edit-expense')).toBeVisible()
  await expect(page.getByTestId('expense-title')).toHaveValue('Cab to airport')
  await page.getByTestId('amount-input').fill('750')
  await page.getByTestId('composer-save').click()
  await expect(page.getByTestId('screen-edit-expense')).toHaveCount(0)
  await expect(page.getByTestId('expense-detail-amount')).toHaveText('₹750.00')
  await expect(page.getByTestId('history-edited')).toContainText('Amount: ₹600.00 → ₹750.00')

  await page.getByTestId('expense-menu').click()
  await page.getByTestId('expense-delete').click()
  await expect(page.getByText('Expense deleted')).toBeVisible()
  await page.getByRole('button', {name: 'Undo'}).click()

  await page.goto(`/expense/${id}`)
  await expect(page.getByTestId('expense-detail-title')).toHaveText('Cab to airport')
  await expect(page.getByTestId('expense-deleted')).toHaveCount(0)
  await expect(page.getByTestId('history-restored')).toBeVisible()
})

test('a deleted expense says so and can be restored', async ({page}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-title').fill('Snacks')
  await page.getByTestId('amount-input').fill('90')
  const id = await saveAndView(page)
  await page.getByTestId('expense-menu').click()
  await page.getByTestId('expense-delete').click()
  await expect(page.getByText('Expense deleted')).toBeVisible()
  await page.goto(`/expense/${id}`)
  await expect(page.getByTestId('expense-deleted')).toBeVisible()
  await page.getByTestId('expense-restore').click()
  await expect(page.getByTestId('expense-deleted')).toHaveCount(0)
})

test('future dates are marked upcoming', async ({page}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-date').click()
  await page.getByTestId('calendar-next').click()
  await page.locator('[data-testid^="calendar-day-"]').nth(14).click()
  await expect(page.getByTestId('upcoming-tag')).toBeVisible()
})

test('a draft survives closing', async ({page}) => {
  await openAddExpense(page)
  await page.getByTestId('expense-title').fill('Half-typed groceries')
  await page.getByTestId('composer-cancel').click()
  await page.getByTestId('draft-save').click()
  await expect(page.getByTestId('screen-add-expense')).toHaveCount(0)

  await page.reload()
  await page.getByTestId('sidebar-add').click()
  await expect(page.getByTestId('expense-title')).toHaveValue('Half-typed groceries')
  await page.getByTestId('draft-start-over').click()
  await expect(page.getByTestId('expense-title')).toHaveValue('')
})

test('add a friend without an account', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await page.getByTestId('people-add-friend').click()
  await expect(page.getByTestId('screen-add-friend')).toBeVisible()
  await expect(page.getByTestId('composer-save')).toBeDisabled()
  await expect(page.getByTestId('friend-invite-unavailable')).toContainText('Available when you sign in')
  await page.getByTestId('friend-name').fill('Kabir Rao')
  await page.getByTestId('composer-save').click()
  await expect(page.getByText('Kabir Rao added')).toBeVisible()
  await expect(page.getByTestId('person-Kabir Rao')).toBeVisible()
})

test('create a trip group with members and dates', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/groups/new?demo=1')
  await expect(page.getByTestId('screen-create-group')).toBeVisible()
  await page.getByTestId('group-name').fill('Manali')
  await page.getByTestId('group-members').click()
  await expect(page.getByTestId('person-option-Riya Sharma')).toBeVisible()
  await page.getByTestId('person-option-Riya Sharma').click()
  await page.getByTestId('people-done').click()
  await expect(page.getByTestId('group-members-value')).toContainText('Riya Sharma')
  await page.getByTestId('group-start').click()
  await page.getByTestId('calendar-today').click()
  await page.getByTestId('composer-save').click()
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await expect(page.getByText('Manali created')).toBeVisible()
})

test('phones: the FAB opens Add expense full screen; Cancel on an empty form just closes', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await page.getByTestId('fab-add').click()
  const composer = page.getByTestId('screen-add-expense')
  await expect(composer).toBeVisible()
  const box = await composer.boundingBox()
  expect(box!.width).toBe(PHONE.width)
  await page.getByTestId('composer-cancel').click()
  await expect(composer).toHaveCount(0)
})

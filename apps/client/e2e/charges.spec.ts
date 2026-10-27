import {expect, type Page, test} from '@playwright/test'

const DESKTOP = {width: 1440, height: 900}
const PHONE = {width: 390, height: 844}

/** The owner's bill: The Supper Factory, 02/06/2007. Food 1,611.00 in 8 lines, alcohol 400.00 in 2. */
const FOOD = [
  ['Paneer Tikka', '200'],
  ['Dal Makhani', '250'],
  ['Butter Naan', '180'],
  ['Biryani', '210'],
  ['Kebab Platter', '190'],
  ['Raita', '220'],
  ['Gulab Jamun', '171'],
  ['Masala Papad', '190'],
] as const
const ALCOHOL = [
  ['Whisky', '250'],
  ['Beer', '150'],
] as const

async function openAddExpense(page: Page, size: {width: number; height: number}) {
  await page.setViewportSize(size)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId(size.width < 600 ? 'fab-add' : 'sidebar-add').click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
}

async function addCharge(
  page: Page,
  c: {name: string; kind: string; rate: string; classes?: string[]; stacks?: boolean},
) {
  await page.getByTestId('charge-add').click()
  const sheet = page.getByTestId('charge-sheet')
  await sheet.getByTestId('charge-name').fill(c.name)
  await sheet.getByTestId(`charge-kind-${c.kind}`).click()
  await sheet.getByTestId('charge-value').fill(c.rate)
  if (c.classes) {
    await sheet.getByTestId('charge-scope-classes').click()
    for (const id of c.classes) await sheet.getByTestId(`charge-class-${id}`).click()
  }
  if (c.stacks) await sheet.getByTestId('charge-stacks').click()
  await sheet.getByTestId('sheet-save').click()
  await expect(page.getByTestId('charge-sheet')).toHaveCount(0)
}

async function enterBill(page: Page) {
  await page.getByTestId('expense-title').fill('The Supper Factory')
  await page.getByTestId('amount-input').fill('2522')
  await page.getByTestId('expense-people').click()
  await page.getByTestId('person-option-Riya Sharma').click()
  await page.getByTestId('people-dialog').getByTestId('sheet-close').click()
  await expect(page.getByTestId('people-dialog')).toHaveCount(0)
  await page.getByTestId('split-mode-items').click()
  let n = 0
  for (const [name, amount] of [...FOOD, ...ALCOHOL]) {
    await page.getByTestId('item-add').click()
    await page.getByTestId(`item-${n}-name`).fill(name)
    await page.getByTestId(`item-${n}-amount`).fill(amount)
    n++
  }
  // Riya had only food: take her off both drinks.
  for (const i of [8, 9])
    await page.getByTestId(`item-${i}-person-Riya Sharma`).click({button: 'right'})

  // A custom list of charges: classes appear on every item.
  await page.getByTestId('charge-preset-custom').click()
  await page.getByTestId('item-0-class').click({button: 'right'})
  await expect(page.getByTestId('class-selection-bar')).toBeVisible()
  for (let i = 1; i < 8; i++) await page.getByTestId(`item-${i}-class`).click()
  await page.getByTestId('class-apply-food').click()
  await expect(page.getByTestId('class-selection-bar')).toHaveCount(0)
  for (const i of [8, 9]) {
    await page.getByTestId(`item-${i}-class`).click()
    await page.getByTestId('class-option-alcohol').click()
    await expect(page.getByTestId('class-picker')).toHaveCount(0)
    await expect(page.getByTestId(`item-${i}-class`)).toContainText('Alcohol')
  }
  await expect(page.getByTestId('item-0-class')).toContainText('Food')
  await expect(page.getByTestId('item-9-class')).toContainText('Alcohol')

  await addCharge(page, {name: 'Service', kind: 'service', rate: '10'})
  await addCharge(page, {name: 'VAT 12.5%', kind: 'tax', rate: '12.5', classes: ['food'], stacks: true})
  await addCharge(page, {name: 'VAT 20%', kind: 'tax', rate: '20', classes: ['alcohol'], stacks: true})
}

for (const [label, size] of [
  ['phone', PHONE],
  ['desktop', DESKTOP],
] as const) {
  test(`the Supper Factory bill (${label}): 201.10 / 221.51 / 88.00, a 0.39 round-off, saved and itemised on the detail page`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openAddExpense(page, size)
    await enterBill(page)

    // Each charge, to the minor unit.
    await expect(page.getByTestId('charge-0-amount')).toHaveText('₹201.10')
    await expect(page.getByTestId('charge-1-amount')).toHaveText('₹221.51')
    await expect(page.getByTestId('charge-2-amount')).toHaveText('₹88.00')
    const reconciliation = page.getByTestId('bill-reconciliation')
    await expect(reconciliation).toContainText('₹2,011.00')
    await expect(reconciliation).toContainText('₹2,521.61')

    // The printed 2,522.00 is 0.39 more: shown in red, and Save waits (never hidden).
    await expect(page.getByTestId('bill-gap')).toContainText('₹0.39')
    await expect(page.getByTestId('sheet-save')).toBeDisabled()
    await page.getByTestId('bill-round-off-add').click()
    await expect(page.getByTestId('bill-gap')).toHaveCount(0)
    await expect(page.getByTestId('bill-line-round-off')).toContainText('₹0.39')
    await expect(page.getByTestId('bill-line-total')).toContainText('₹2,522.00')
    await expect(page.getByTestId('sheet-save')).toBeEnabled()

    // Riya had only food: no part of the alcohol VAT.
    await page.getByTestId('sheet-save').click()
    await expect(page.getByTestId('expense-saved')).toBeVisible()
    await page.getByRole('button', {name: 'View expense'}).click()
    await expect(page.getByTestId('screen-expense')).toBeVisible()

    const detail = page.getByTestId('expense-items')
    await expect(detail.getByTestId('expense-class-food')).toContainText('Food')
    await expect(detail.getByTestId('expense-class-alcohol')).toContainText('Alcohol')
    await expect(detail.getByTestId('expense-charge-0')).toContainText('₹201.10')
    await expect(detail.getByTestId('expense-charge-0')).toContainText('on all items')
    await expect(detail.getByTestId('expense-charge-1')).toContainText('₹221.51')
    await expect(detail.getByTestId('expense-charge-2')).toContainText('₹88.00')
    await expect(detail.getByTestId('expense-charge-2')).toContainText('20% · on Alcohol + Service')
    await expect(detail.getByTestId('expense-charge-round-off')).toContainText('₹0.39')
    await expect(detail.getByTestId('expense-charge-total')).toContainText('₹2,522.00')
    const riya = detail.getByTestId('expense-person-Riya Sharma')
    await expect(riya).toContainText('VAT 12.5%')
    await expect(riya).not.toContainText('VAT 20%')
    await expect(detail.getByTestId('expense-person-You')).toContainText('VAT 20%')
  })
}

test('presets in one tap; save a merchant setup and get it back as a dashed suggestion', async ({
  page,
}) => {
  await openAddExpense(page, DESKTOP)
  await page.getByTestId('expense-title').fill('Toit Brewpub')
  await page.getByTestId('split-mode-items').click()
  await page.getByTestId('item-add').click()
  await page.getByTestId('item-0-name').fill('Pizza')
  await page.getByTestId('item-0-amount').fill('1000')
  await page.getByTestId('charge-preset-restaurant-india').click()
  await expect(page.getByTestId('charge-0-amount')).toHaveText('₹100.00')
  await expect(page.getByTestId('charge-1-amount')).toHaveText('₹55.00')
  await page.getByTestId('charge-save-setup').click()
  await page.getByTestId('amount-input').fill('1155')
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('expense-saved')).toBeVisible()
  // The same merchant on a new bill: the setup is offered, not forced.
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
  await page.getByTestId('expense-title').fill('toit  brewpub')
  await page.getByTestId('split-mode-items').click()
  await expect(page.getByTestId('charges-suggestion')).toContainText('Service charge 10%')
  await page.getByTestId('charges-suggestion').click()
  await expect(page.getByTestId('charge-0')).toBeVisible()
  await expect(page.getByTestId('charges-suggestion')).toHaveCount(0)
  await expect(page.getByTestId('charge-preset-restaurant-india')).toHaveAttribute('aria-checked', 'true')
})

test('Simple stays the default: the four plain rows, no classes', async ({page}) => {
  await openAddExpense(page, PHONE)
  await page.getByTestId('split-mode-items').click()
  await page.getByTestId('item-add').click()
  await expect(page.getByTestId('item-tax')).toBeVisible()
  await expect(page.getByTestId('item-0-class')).toHaveCount(0)
  await expect(page.getByTestId('charge-preset-simple')).toHaveAttribute('aria-checked', 'true')
})

test('Settings: tax classes can be added, renamed, hidden and used', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.goto('/settings/defaults')
  const section = page.getByTestId('pref-bill.taxClasses')
  await expect(section.getByTestId('taxclass-food')).toContainText('Food')
  await section.getByTestId('taxclass-add').click()
  await page.getByTestId('taxclass-name').fill('Desserts')
  await page.getByTestId('taxclass-sheet').getByTestId('sheet-save').click()
  await expect(section).toContainText('Desserts')
  await section.getByTestId('taxclass-hide-soft').click()
  await expect(section.getByTestId('taxclass-soft')).toContainText('Hidden')
  // The picker offers the new class and not the hidden one.
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await page.getByTestId('split-mode-items').click()
  await page.getByTestId('item-add').click()
  await page.getByTestId('charge-preset-custom').click()
  await page.getByTestId('item-0-class').click()
  await expect(page.getByTestId('class-option-soft')).toHaveCount(0)
  await expect(page.getByTestId('class-picker')).toContainText('Desserts')
})

import {expect, type Locator, type Page, test} from '@playwright/test'

import {composeButton} from './composer'
import {openDemo} from './openDemo'
import {DESKTOP, PHONE} from './viewports'

/*
 * Owner rule: every modal on a phone is a drawer. Below 800px a prompt, a
 * form sheet and a menu rise from the bottom edge at full width with a
 * handle; dragging the handle down closes them. 800px and up keeps
 * Bluesky's centred popup.
 */


async function settled(locator: Locator) {
  await expect(locator).toBeVisible()
  /* Wait for the rise (or zoom) to finish: the box holds still for a while. */
  let last = ''
  let still = 0
  await expect
    .poll(
      async () => {
        const box = JSON.stringify(await locator.boundingBox())
        still = box === last ? still + 1 : 0
        last = box
        return still
      },
      {intervals: [100]},
    )
    .toBeGreaterThanOrEqual(3)
  return (await locator.boundingBox())!
}

/** The drawer's bottom edge, once it has come to rest on the viewport's. */
async function expectAtBottom(locator: Locator) {
  await expect
    .poll(async () => {
      const box = (await locator.boundingBox())!
      return Math.round(box.y + box.height)
    })
    .toBe(PHONE.height)
}

async function openResetPrompt(page: Page) {
  await page.goto('/settings/appearance')
  await page.getByTestId('settings-section-reset').click()
  return page.getByRole('dialog').filter({hasText: 'Reset Appearance?'})
}

async function openFilters(page: Page) {
  await openDemo(page, '/people')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  await page.getByTestId('screen-people').getByTestId('list-filters').click()
  return page
    .getByRole('dialog')
    .filter({has: page.getByTestId('friends-filters-sheet')})
}

async function dragHandle(page: Page, dialog: Locator, distance: number) {
  const handle = (await dialog.getByTestId('dialog-handle').boundingBox())!
  const x = handle.x + handle.width / 2
  const y = handle.y + handle.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  // Slow steps: distance, not a flick, decides.
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x, y + (distance * i) / 10)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
}

for (const [name, open, isForm] of [
  ['the Reset Appearance prompt', openResetPrompt, false],
  ['the friends filters sheet', openFilters, true],
] as const) {
  test(`phone: ${name} is a drawer from the bottom edge; a short drag springs back, a long one closes it`, async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    const dialog = await open(page)
    await expectAtBottom(dialog)
    const box = await settled(dialog)
    expect(box.x).toBe(0)
    expect(box.width).toBe(PHONE.width)
    await expect(dialog.getByTestId('dialog-handle')).toBeVisible()

    await dragHandle(page, dialog, box.height * 0.1)
    await expectAtBottom(dialog)
    await expect(dialog).toBeVisible()

    await dragHandle(page, dialog, box.height * 0.5)
    await expect(dialog).toHaveCount(0)
  })

  test(`desktop: ${name} stays a centred popup without a handle`, async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    const dialog = await open(page)
    const box = await settled(dialog)
    expect(Math.abs(box.x + box.width / 2 - DESKTOP.width / 2)).toBeLessThan(2)
    expect(box.width).toBeLessThan(DESKTOP.width / 2)
    if (isForm) {
      expect(
        Math.abs(box.y + box.height / 2 - DESKTOP.height / 2),
      ).toBeLessThan(24)
    } else {
      // Bluesky's prompt floats in the upper middle (its 60vh "natural centring").
      expect(box.y).toBeGreaterThan(DESKTOP.height * 0.1)
      expect(box.y + box.height).toBeLessThan(DESKTOP.height * 0.6)
    }
    await expect(dialog.getByTestId('dialog-handle')).toHaveCount(0)
  })
}

test('phone: dragging a sheet with unsaved changes away asks "Discard changes?" and the sheet stays', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  const dialog = await openFilters(page)
  const box = await settled(dialog)
  await page.getByTestId('filter-show-youOwe').click()
  await dragHandle(page, dialog, box.height * 0.5)
  await expect(page.getByText('Discard changes?')).toBeVisible()
  await page.getByRole('button', {name: 'Keep editing'}).click()
  await expect(page.getByText('Discard changes?')).toHaveCount(0)
  await expectAtBottom(dialog)
  await expect(page.getByTestId('filter-show-youOwe')).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('phone: a menu opens as a drawer and its rows still act', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page, '/people')
  /* The demo seed must have landed before navigating away, or /groups loads empty. */
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  await page.goto('/groups')
  await page.getByTestId('group-Lisbon').click()
  await page.getByTestId('group-more').click()
  const dialog = page
    .getByRole('dialog')
    .filter({has: page.getByTestId('group-menu-edit')})
  await expectAtBottom(dialog)
  expect((await settled(dialog)).width).toBe(PHONE.width)
  await page.getByTestId('group-menu-edit').click()
  await expect(page.getByTestId('edit-group-sheet')).toBeVisible()
})

test.describe('touch phone', () => {
  test.use({viewport: PHONE, hasTouch: true, isMobile: true})

  test('Add expense rises as a drawer with a handle', async ({page}) => {
    await openDemo(page)
    await composeButton(page).click()
    const sheet = page.getByTestId('screen-add-expense')
    await expectAtBottom(sheet)
    expect((await settled(sheet)).width).toBe(PHONE.width)
    await expect(sheet.getByTestId('dialog-handle')).toBeVisible()
  })
})

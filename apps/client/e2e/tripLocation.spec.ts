import {expect, type Page, test} from '@playwright/test'

/* F-705 (owner 182): a trip asks where it is. Runs at a phone and at a desktop width. */
const WIDTHS = [
  {name: '390', size: {width: 390, height: 844}},
  {name: '1440', size: {width: 1440, height: 900}},
]

async function ready(page: Page) {
  await page.goto('/groups/new')
  await expect(page.getByTestId('create-group-name')).toBeVisible()
}

for (const {name, size} of WIDTHS) {
  test(`a trip's location: create, row, header, edit, search, type switch keeps it (${name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await ready(page)

    // Trip is the default type, so the field is there; the other types hide it.
    const where = page.getByTestId('create-group-location')
    await expect(page.getByText('Where? (optional)')).toBeVisible()
    await expect(where).toHaveAttribute('placeholder', 'e.g. Goa')
    await page.getByTestId('create-group-kind-home').click()
    await expect(where).toHaveCount(0)
    await page.getByTestId('create-group-kind-trip').click()
    await expect(where).toHaveValue('')
    await page.getByTestId('create-group-name').fill('Beach week')
    await where.fill('  Goa ')
    // Switching away hides the field and keeps the value.
    await page.getByTestId('create-group-kind-home').click()
    await expect(where).toHaveCount(0)
    await page.getByTestId('create-group-kind-trip').click()
    await expect(where).toHaveValue('  Goa ')
    if (name === '390')
      await page.screenshot({
        path: process.env.TRIP_SHOT ?? 'trip-new-group-390.png',
      })
    await page.getByTestId('sheet-save').click()

    // The header reads Trip · Goa · 1 member.
    await expect(page.getByTestId('group-name')).toHaveText('Beach week')
    await expect(page.getByTestId('group-byline')).toHaveText(
      'Trip · Goa · 1 member',
    )
    if (name === '390') {
      await page.reload() // drops the "created" toast so the header is clear
      await expect(page.getByTestId('group-byline')).toHaveText(
        'Trip · Goa · 1 member',
      )
      await page.screenshot({
        path: process.env.TRIP_HEADER_SHOT ?? 'trip-group-header-390.png',
      })
    }

    // The Groups row reads it too.
    await page.goto('/groups')
    await expect(page.getByTestId('group-Beach week')).toContainText(
      'Trip · Goa · 1 member',
    )

    // Edit: shows the saved value, changes it, and the header follows.
    await page.getByTestId('group-Beach week').click()
    await page.getByTestId('group-more').click()
    await page.getByTestId('group-menu-edit').click()
    const sheet = page.getByTestId('edit-group-sheet')
    await expect(page.getByTestId('edit-group-location')).toHaveValue('Goa')
    await page.getByTestId('edit-group-location').fill('Gokarna')
    await sheet.getByTestId('sheet-save').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('group-byline')).toHaveText(
      'Trip · Gokarna · 1 member',
    )

    // Edit: switching to Home and back keeps the value; saved as Home it is hidden, then back as Trip it returns.
    await page.getByTestId('group-more').click()
    await page.getByTestId('group-menu-edit').click()
    await page.getByTestId('edit-group-kind-home').click()
    await expect(page.getByTestId('edit-group-location')).toHaveCount(0)
    await sheet.getByTestId('sheet-save').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('group-byline')).toHaveText('Home · 1 member')
    await page.getByTestId('group-more').click()
    await page.getByTestId('group-menu-edit').click()
    await page.getByTestId('edit-group-kind-trip').click()
    await expect(page.getByTestId('edit-group-location')).toHaveValue('Gokarna')
    await sheet.getByTestId('sheet-save').click()
    await expect(page.getByTestId('group-byline')).toHaveText(
      'Trip · Gokarna · 1 member',
    )

    // Search finds the group by its place.
    await page.goto('/groups')
    await page
      .getByTestId('screen-groups')
      .getByTestId('header-search-ask')
      .click()
    await page.getByTestId('search-input').fill('gokarna')
    await expect(page.getByTestId('search-section-groups')).toContainText(
      /Groups\s+1/,
    )
    const found = page.getByTestId('search-ask')
    await expect(found).toContainText('Beach week')
    await expect(found).toContainText('Trip · Gokarna')
  })
}

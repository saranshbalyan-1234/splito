import {expect, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * ARCHITECTURE 26.18: Activity's friend-request rows are the one-line
 * RequestRow layout. Accept / Decline sit on the right (icon-only on phones,
 * icon + text from rail up), centred with the text, in place of the "..."
 * menu, whose items open on right-click (long-press on touch).
 */
const DESKTOP = {width: 1440, height: 900}

for (const viewport of [{width: 320, height: 800}, {width: 390, height: 844}, DESKTOP]) {
  test(`Activity request row is one line with Accept / Decline on the right at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await openDemo(page)
    await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
    await page.getByTestId('tab-activity').click()
    const row = page
      .getByTestId('activity-friendRequest.received')
      .filter({hasText: 'Sara Ali'})
    await row.scrollIntoViewIfNeeded()
    await expect(row).toContainText('sent you a friend request')

    const isPhone = viewport.width < 800
    const r = (await row.boundingBox())!
    const text = (await row.getByText('sent you a friend request').boundingBox())!
    const accept = row.getByTestId('activity-request-accept')
    const decline = row.getByTestId('activity-request-decline')
    const a = (await accept.boundingBox())!
    const d = (await decline.boundingBox())!
    // On the right of the text, inside the row, side by side, centred vertically.
    expect(a.x).toBeGreaterThanOrEqual(text.x + text.width - 1)
    expect(d.x).toBeGreaterThan(a.x + a.width)
    expect(d.x + d.width).toBeLessThanOrEqual(r.x + r.width)
    expect(Math.abs(a.y - d.y)).toBeLessThan(1)
    expect(Math.abs(a.y + a.height / 2 - (r.y + r.height / 2))).toBeLessThan(3)
    if (isPhone) {
      await expect(accept).toHaveText('')
      await expect(accept).toHaveAttribute(
        'aria-label',
        'Accept Sara Ali’s friend request',
      )
    } else {
      await expect(accept).toHaveText('Accept')
      await expect(decline).toHaveText('Decline')
    }

    // No "..." on a request row; its items are on right-click.
    await expect(row.getByTestId('activity-menu')).toHaveCount(0)
    await row.click({button: 'right', position: {x: 40, y: 20}})
    await expect(page.getByTestId('activity-menu-markRead')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('activity-menu-markRead')).toHaveCount(0)

    // And from the keyboard: the Menu key or Shift+F10 on the focused row.
    for (const key of ['ContextMenu', 'Shift+F10']) {
      await row.getByRole('link').focus()
      await page.keyboard.press(key)
      await expect(page.getByTestId('activity-menu-markRead')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('activity-menu-markRead')).toHaveCount(0)
    }

    await accept.click()
    await expect(accept).toHaveCount(0)
  })
}

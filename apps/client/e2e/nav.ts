import {expect, type Page} from '@playwright/test'

/** The widest window that still counts as a phone (alf `gtMobile` starts at 800). */
const PHONE_MAX = 800

/**
 * Opens the side drawer the way a thumb does (owner 201): a swipe from the left edge. Wide windows have no swipe (the
 * sidebar is on screen), so the same drawer is opened by its address (`?drawer=menu`, F-241).
 */
export async function openDrawer(page: Page) {
  if ((page.viewportSize()?.width ?? 0) >= PHONE_MAX) {
    const url = new URL(page.url())
    url.searchParams.set('drawer', 'menu')
    await page.goto(url.toString())
  } else {
    await page.evaluate(() => {
      const fire = (type: string, x: number, y: number) => {
        const touch = new Touch({identifier: 1, target: document.body, clientX: x, clientY: y})
        document.dispatchEvent(
          new TouchEvent(type, {touches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true}),
        )
      }
      fire('touchstart', 4, 400)
      fire('touchmove', 40, 402)
      fire('touchmove', 90, 404)
      fire('touchend', 90, 404)
    })
  }
  await expect(page.getByTestId('drawer')).toBeVisible()
}

/** The header avatar of the page showing opens Profile at every width (owner 201). */
export async function openProfile(page: Page) {
  await page.getByTestId('header-avatar').locator('visible=true').first().click()
  await expect(page.getByTestId('screen-profile')).toBeVisible()
}

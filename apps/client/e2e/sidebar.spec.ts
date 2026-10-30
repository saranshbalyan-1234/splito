import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-265 (owner 188, footer placement replaced by owner 214): the desktop sidebar is as wide as its content needs; the
 * logo, items and Add expense pill are one block at the top and the footer links are pinned at the bottom. Checked at 1300, 1440 and 1920 in English and Hindi, with every item in the list (Ask Splito
 * is not an item, owner 200).
 */
const WIDTHS = [1300, 1440, 1920]
const HEIGHT = 900
/* About 200 px in English; the footer row sets it. */
const TARGET = {min: 196, max: 224}

async function openSidebar(page: Page, width: number, lang: 'en' | 'hi') {
  await page.setViewportSize({width, height: HEIGHT})
  await openDemo(page)
  await page.evaluate(async l => {
    const s = (window as any).splito
    await s.setPref('language', l)
    await s.setPref('tabs', ['people', 'groups', 'analytics', 'activity', 'settings'])
  }, lang)
  await expect(page.getByTestId('tab-settings')).toBeVisible()
}

for (const lang of ['en', 'hi'] as const) {
  for (const width of WIDTHS) {
    test(`sidebar fits its content at ${width} px (${lang})`, async ({page}) => {
      await openSidebar(page, width, lang)
      const nav = page.getByRole('navigation')
      const navBox = (await nav.boundingBox())!
      expect(navBox.width).toBeGreaterThanOrEqual(TARGET.min)
      expect(navBox.width).toBeLessThanOrEqual(TARGET.max)

      // No label or footer link is cut off or spills past the sidebar's right edge.
      const clipped = await nav.evaluate(el => {
        const right = el.getBoundingClientRect().right
        return [...el.querySelectorAll('*')]
          .filter(e => e.children.length === 0 && e.textContent?.trim())
          .filter(e => {
            const r = e.getBoundingClientRect()
            /* RN-web sets ellipsis on every Text, so truncation shows only as overflow. Inline links report a clientWidth of 0, so the scroll check only applies to boxes. */
            return (e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1) || r.right > right - 1
          })
          .map(e => e.textContent)
      })
      expect(clipped).toEqual([])

      // The items and the pill stay at the top; the footer links sit at the bottom of the viewport (owner 214).
      const pill = (await page.getByTestId('sidebar-add').boundingBox())!
      const footer = (await page.getByTestId('nav-footer-links').boundingBox())!
      expect(pill.y + pill.height).toBeLessThan(HEIGHT / 2)
      expect(footer.y).toBeGreaterThan(pill.y + pill.height + 100)
      expect(HEIGHT - (footer.y + footer.height)).toBeLessThanOrEqual(40)
      expect(footer.y + footer.height).toBeLessThanOrEqual(HEIGHT)
      if (lang === 'en' && process.env.SIDEBAR_SHOTS && width !== 1300) await page.screenshot({path: `${process.env.SIDEBAR_SHOTS}/nohome-sidebar-${width}.png`})

      // The content column starts where the sidebar ends; nothing overflows sideways.
      const screen = (await page.getByTestId('screen-people').boundingBox())!
      expect(screen.x).toBe(navBox.width)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
}

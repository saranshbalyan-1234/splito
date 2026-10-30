import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * ARCHITECTURE 26.9, owner 168: the drawer and a heavy sheet OPEN first (the panel moves at once, showing only its
 * light shell) and the heavy content mounts after the motion has ended, on the real end-of-motion signal, not on a
 * fixed two frames. Sampled every animation frame on a phone.
 */
test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})

type Frame = {t: number; shell: number | null; content: boolean}

/** Samples `shell`'s top/left edge and whether `content` exists, every frame, until `done`. */
function sample(page: Page, shellSel: string, edge: 'top' | 'left', contentSel: string) {
  return page.evaluate(
    ([shellSel, edge, contentSel]) => {
      const w = window as unknown as {__f: Frame[]; __stop?: boolean}
      w.__f = []
      w.__stop = false
      const frame = () => {
        if (w.__stop) return
        const el = document.querySelector(shellSel)
        w.__f.push({
          t: performance.now(),
          shell: el ? Math.round(el.getBoundingClientRect()[edge as 'top' | 'left']) : null,
          content: !!document.querySelector(contentSel),
        })
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    },
    [shellSel, edge, contentSel] as const,
  )
}
/** The samples so far; the sampler stops (it must not run on for the rest of the test). */
const frames = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {__f: Frame[]; __stop?: boolean}
    w.__stop = true
    return w.__f
  })

function check(f: Frame[]) {
  const withShell = f.filter(x => x.shell != null)
  expect(withShell.length, 'the shell showed').toBeGreaterThan(3)
  const final = withShell.at(-1)!.shell!
  const firstContent = f.findIndex(x => x.content)
  expect(firstContent, 'the content mounted').toBeGreaterThan(-1)
  const firstShell = f.findIndex(x => x.shell != null)
  // The shell is on screen, still moving, before any of the content exists...
  const movingBefore = f.slice(firstShell, firstContent).filter(x => x.shell != null && Math.abs(x.shell - final) > 8)
  expect(movingBefore.length, 'frames where the shell moved with no content yet').toBeGreaterThan(0)
  // ...and the content appears only once the shell has come to rest.
  expect(Math.abs(f[firstContent]!.shell! - final), 'the shell is at rest when the content mounts').toBeLessThanOrEqual(2)
}

test('the drawer slides first, its menu mounts after the slide', async ({page}) => {
  await openDemo(page)
  await expect(page.getByTestId('screen-home')).toBeVisible()
  await page.waitForTimeout(800)
  await sample(page, '[role="dialog"][aria-label="Menu"]', 'left', '[data-testid="drawer-groups"]')
  await page.getByTestId('header-avatar').tap()
  await expect(page.getByTestId('drawer-groups')).toBeVisible()
  await page.waitForTimeout(300)
  const f = await frames(page)
  check(f)
  // The light parts (profile card, footer) are in the sliding panel from its first frame.
  await expect(page.getByTestId('drawer-profile')).toBeVisible()
})

test('a heavy sheet rises first, its body mounts after the rise', async ({page}) => {
  await openDemo(page)
  await page.getByTestId('tab-groups').tap()
  await expect(page.getByTestId('screen-groups')).toBeVisible()
  await page.waitForTimeout(800)
  await sample(page, '[data-testid="groups-filters-sheet"]', 'top', '[data-testid="filter-show-owed"]')
  await page.getByTestId('screen-groups').getByTestId('list-filters').tap()
  await expect(page.getByTestId('filter-show-owed')).toBeVisible()
  await page.waitForTimeout(300)
  check(await frames(page))
})

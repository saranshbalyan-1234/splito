import {expect, test} from '@playwright/test'

import {openDemo} from '../e2e/openDemo'

/*
 * The owner's case (owners 150, 166, 189): taps between tabs milliseconds apart, at 390 px with touch, on the large
 * demo. Cold: right after launch (first visits); warm: every tab visited first. Per tap it prints `tab:lit/screen`
 * (ms from pointerdown to the tab's highlight and to its screen showing) and the long tasks, at CPU x1, x4 and x6;
 * it asserts that the app lands on the last tab tapped. Run: `pnpm e2e:build && E2E_PORT=8241 pnpm perf -- rapidTabs`.
 * Numbers: ARCHITECTURE 17.1 (2026-10-31). Chromium only: an iPhone delay must be measured in WebKit too.
 */
type Tap = {tab: string; t0: number; lit?: number; screen?: number}
type Win = {__taps: Tap[]; __long: number[]}

test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})

for (const [rate, cold] of [[1, true], [4, true], [1, false], [6, false]] as const) {
  test(`rapid tab taps, CPU x${rate}${cold ? ' cold' : ''}`, async ({page, context}) => {
    test.setTimeout(600_000)
    await openDemo(page, '/people')
    await expect(page.getByTestId('screen-people').first()).toBeVisible({timeout: 60_000})
    const tabs = ['people', 'groups', 'analytics', 'activity', 'settings']
    if (!cold) {
      for (const t of tabs) {
        await page.getByTestId(`tab-${t}`).tap()
        await expect(page.getByTestId(`screen-${t}`).first()).toBeVisible({timeout: 60_000})
      }
      await page.getByTestId('tab-people').tap()
    }
    await page.waitForTimeout(cold ? 1500 : 4000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', {rate})
    // Record, per tap: pointerdown -> the tapped tab's highlight, -> its screen visible and on top; long tasks.
    await page.evaluate(() => {
      const w = window as unknown as Win
      w.__taps = []
      w.__long = []
      new PerformanceObserver(l => l.getEntries().forEach(e => w.__long.push(Math.round(e.duration)))).observe({type: 'longtask', buffered: false})
      document.addEventListener('pointerdown', ev => {
        const btn = (ev.target as HTMLElement).closest('[data-testid^="tab-"]')
        if (!btn) return
        const tab = btn.getAttribute('data-testid')!.slice(4)
        const t0 = performance.now()
        const rec: Tap = {tab, t0}
        w.__taps.push(rec)
        const screenUp = () => {
          const s = [...document.querySelectorAll(`[data-testid="screen-${tab}"]`)] as HTMLElement[]
          return s.some(el => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden' && el.closest('[aria-hidden="true"],[inert]') === null)
        }
        const lit = () => btn.getAttribute('aria-current') === 'page' || btn.querySelector('[aria-current="page"]') !== null || btn.closest('[aria-current="page"]') !== null
        const check = () => {
          const now = performance.now() - t0
          if (rec.lit === undefined && lit()) rec.lit = Math.round(now)
          if (rec.screen === undefined && screenUp()) rec.screen = Math.round(now)
          if ((rec.screen === undefined || rec.lit === undefined) && now < 8000) requestAnimationFrame(check)
        }
        requestAnimationFrame(check)
      }, true)
    })
    const seq = ['groups', 'analytics', 'activity', 'people', 'analytics', 'groups', 'settings', 'activity', 'people', 'groups', 'analytics', 'people']
    for (const gap of [300, 120, 50]) {
      for (const t of seq) {
        await page.getByTestId(`tab-${t}`).tap({noWaitAfter: true})
        await page.waitForTimeout(gap)
      }
      await page.waitForTimeout(3000)
      const landed = await page.evaluate(() => {
        const last = (window as unknown as Win).__taps.at(-1)!.tab
        return {last, path: location.pathname}
      })
      console.log(`RAPID x${rate}${cold ? 'c' : ''} gap ${gap}ms landed ${JSON.stringify(landed)}`)
      expect(landed.path, 'the last tab tapped wins').toBe(`/${landed.last}`)
    }
    const taps = await page.evaluate(() => (window as unknown as Win).__taps)
    const long = await page.evaluate(() => (window as unknown as Win).__long)
    const fmt = (gapTaps: Tap[]) => gapTaps.map(t => `${t.tab.slice(0, 4)}:${t.lit ?? '-'}/${t.screen ?? '-'}`).join(' ')
    console.log(`RAPID x${rate}${cold ? 'c' : ''} 300ms: ${fmt(taps.slice(0, 12))}`)
    console.log(`RAPID x${rate}${cold ? 'c' : ''} 120ms: ${fmt(taps.slice(12, 24))}`)
    console.log(`RAPID x${rate}${cold ? 'c' : ''}  50ms: ${fmt(taps.slice(24, 36))}`)
    console.log(`RAPID x${rate}${cold ? 'c' : ''} long tasks: n=${long.length} max=${Math.max(0, ...long)} sum=${long.reduce((a, b) => a + b, 0)} top=${[...long].sort((a, b) => b - a).slice(0, 8).join(',')}`)
  })
}

import {expect, test} from '@playwright/test'
import {openDemo} from './openDemo'
test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})
test('dbg', async ({page}) => {
  test.setTimeout(300000)
  const at = async (id: string) => { const b = (await page.getByTestId(id).boundingBox())!; return [b.x + b.width / 2, b.y + b.height / 2] as const }
  for (let i = 0; i < 12; i++) {
    await page.goto('/')
    await openDemo(page)
    await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
    await page.waitForTimeout(1500)
    await page.evaluate(() => {
      const ev: string[] = []
      ;(window as any).__ev = ev
      const t = () => Math.round(performance.now())
      for (const k of ['touchstart', 'touchend', 'click', 'pointerdown', 'pointerup'])
        window.addEventListener(k, (e: any) => ev.push(`${t()} ${k} ${(e.target as HTMLElement).closest?.('[data-testid]')?.getAttribute('data-testid')}`), true)
      for (const m of ['pushState', 'replaceState'] as const) {
        const o = history[m].bind(history)
        history[m] = (...a: any[]) => { ev.push(`${t()} ${m} ${a[2]}`); return (o as any)(...a) }
      }
      const frame = () => {
        const v = (id: string) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(e => e.getClientRects().length > 0)
        for (const id of ['screen-analytics', 'screen-activity']) {
          const key = '__v' + id
          const now = v(id)
          if ((window as any)[key] !== now) { (window as any)[key] = now; ev.push(`${t()} ${id} ${now ? 'SHOWN' : 'hidden'}`) }
        }
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    const a = await at('tab-analytics'); const b = await at('tab-activity')
    await page.touchscreen.tap(a[0], a[1])
    await page.waitForTimeout(50)
    await page.touchscreen.tap(b[0], b[1])
    await page.waitForTimeout(1200)
    const ev = await page.evaluate(() => (window as any).__ev)
    const shown = ev.find((e: string) => e.includes('screen-activity SHOWN'))
    const t2 = ev.filter((e: string) => e.includes(' touchstart '))[1]
    console.log('RUN', i, 'touch2', t2, 'activity', shown)
    if (i === 0 || +shown?.split(' ')[0] - +t2?.split(' ')[0] > 200) console.log('EV', JSON.stringify(ev))
  }
})

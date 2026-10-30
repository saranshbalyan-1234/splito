import {expect, type Page, test} from '@playwright/test'

/*
 * F-264 / owner 185: the launch mark breathes from first paint, before any script, and the launch screen fades out
 * once the app is ready. The JS bundle is held back by a gate the test opens, so "before JS" is exact, not a race.
 */
const SIZES = [
  {name: '390', width: 390, height: 844},
  {name: '1440', width: 1440, height: 900},
]
/* White, and ALF Dim's background (never black). */
const BACKGROUND = {light: 'rgb(255, 255, 255)', dark: 'rgb(21, 29, 40)'}

type Sample = {scale: number; opacity: number}

/** Holds every script request until `release()`. */
async function holdBundle(page: Page) {
  let release!: () => void
  const gate = new Promise<void>(resolve => (release = resolve))
  await page.route('**/_expo/static/js/**', async route => {
    await gate
    await route.continue()
  })
  return release
}

/** The mark's scale and opacity every ~50 ms for `ms`, read from computed style in the page. */
function sampleMark(page: Page, ms: number) {
  return page.evaluate(
    (duration): Promise<Sample[]> =>
      new Promise(resolve => {
        const img = document.querySelector('#launch-mark img') as HTMLElement
        const out: Sample[] = []
        const start = performance.now()
        const tick = () => {
          const cs = getComputedStyle(img)
          out.push({
            scale: new DOMMatrix(
              cs.transform === 'none' ? undefined : cs.transform,
            ).a,
            opacity: Number(cs.opacity),
          })
          if (performance.now() - start < duration) setTimeout(tick, 50)
          else resolve(out)
        }
        tick()
      }),
    ms,
  )
}

const range = (xs: number[]) => ({min: Math.min(...xs), max: Math.max(...xs)})

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`launch screen at ${size.name}, ${scheme}`, () => {
      test.use({
        viewport: {width: size.width, height: size.height},
        colorScheme: scheme,
        reducedMotion: 'no-preference',
      })

      test('breathes before any script, then fades out when the app is ready', async ({
        page,
      }) => {
        await page.addInitScript(() => {
          const w = window as unknown as {__shifts: number}
          w.__shifts = 0
          new PerformanceObserver(list => {
            for (const e of list.getEntries() as unknown as {
              value: number
              sources?: {node?: Node}[]
            }[]) {
              // Only a shift of the launch screen itself counts here; the app's own loading is not its business.
              if (
                e.sources?.some(
                  s =>
                    s.node &&
                    document.getElementById('launch')?.contains(s.node),
                )
              )
                w.__shifts += e.value
            }
          }).observe({type: 'layout-shift', buffered: true})
        })
        const release = await holdBundle(page)
        await page.goto('/', {waitUntil: 'commit'})
        const mark = page.locator('#launch-mark img')
        await expect(mark).toBeVisible()

        // No JS has run: React has drawn nothing into #root.
        expect(
          await page.evaluate(
            () => document.getElementById('root')?.childElementCount,
          ),
        ).toBe(0)

        // The animation is the CSS one, running, on the mark; the screen is the right colour and covers the window.
        const anim = await page.evaluate(() => {
          const a = document
            .getAnimations()
            .find(x =>
              (x.effect as KeyframeEffect | null)?.target?.closest?.(
                '#launch-mark',
              ),
            ) as CSSAnimation | undefined
          const effect = a?.effect?.getComputedTiming()
          return {
            name: a?.animationName,
            state: a?.playState,
            duration: effect?.duration,
            iterations: effect?.iterations,
          }
        })
        expect(anim).toEqual({
          name: 'launchBreathe',
          state: 'running',
          duration: 1200,
          iterations: Infinity,
        })
        const launch = page.locator('#launch')
        await expect(launch).toHaveCSS('background-color', BACKGROUND[scheme])
        expect(await launch.boundingBox()).toMatchObject({
          x: 0,
          y: 0,
          width: expect.any(Number),
          height: size.height,
        })

        // It zooms 1 -> 1.08 -> 1 over about 1.2 s, and stays centred while doing so.
        const samples = await sampleMark(page, 1400)
        const scales = range(samples.map(s => s.scale))
        expect(scales.min).toBeLessThan(1.02)
        expect(scales.max).toBeGreaterThan(1.06)
        expect(scales.max).toBeLessThanOrEqual(1.0801)
        expect(range(samples.map(s => s.opacity))).toEqual({min: 1, max: 1})
        const box = (await mark.boundingBox())!
        expect(
          Math.abs(
            box.x +
              box.width / 2 -
              (await page.evaluate(
                () => document.documentElement.clientWidth,
              )) /
                2,
          ),
        ).toBeLessThan(1)

        // The app loads; the first screen shows and the launch screen leaves, without shifting anything.
        const rootBefore = await page.evaluate(() =>
          document.getElementById('root')!.getBoundingClientRect().toJSON(),
        )
        release()
        await expect(page.getByTestId('screen-home')).toBeAttached()
        await expect(launch).toHaveCount(0)
        const rootAfter = await page.evaluate(() =>
          document.getElementById('root')!.getBoundingClientRect().toJSON(),
        )
        expect(rootAfter).toMatchObject({
          x: rootBefore.x,
          y: rootBefore.y,
          width: rootBefore.width,
        })
        expect(
          await page.evaluate(
            () => (window as unknown as {__shifts: number}).__shifts,
          ),
        ).toBe(0)
      })
    })
  }
}

test.describe('launch screen under reduced motion', () => {
  test.use({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'})

  test('pulses its opacity instead of zooming, then leaves', async ({page}) => {
    const release = await holdBundle(page)
    await page.goto('/', {waitUntil: 'commit'})
    await expect(page.locator('#launch-mark img')).toBeVisible()
    const name = await page.evaluate(
      () =>
        (
          document
            .getAnimations()
            .find(x =>
              (x.effect as KeyframeEffect).target?.closest('#launch-mark'),
            ) as CSSAnimation
        ).animationName,
    )
    expect(name).toBe('launchPulse')
    const samples = await sampleMark(page, 2600)
    expect(range(samples.map(s => s.scale))).toEqual({min: 1, max: 1})
    const opacity = range(samples.map(s => s.opacity))
    expect(opacity.min).toBeLessThan(0.6)
    expect(opacity.max).toBeGreaterThan(0.95)
    release()
    await expect(page.locator('#launch')).toHaveCount(0)
  })
})

import {expect, type Page, test} from '@playwright/test'

import {signedOut} from './signedOut'

/*
 * F-249: the intro slides before sign-in. Every spec here starts from a fresh install (`signedOut`): no session, intro
 * not seen. The signed-in specs never see the intro (the sign-in hook marks it seen).
 */
test.use(signedOut)

const PHONE = {width: 390, height: 844}
const DESKTOP = {width: 1440, height: 900}
const TITLES = ['Split anything with anyone', 'Bills done right', 'Settle up in the fewest payments', 'Search or ask anything', 'Yours, and works offline']

const databases = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map(d => d.name))
const slide = (page: Page, n: number) => expect(page.getByTestId('welcome-title')).toHaveText(TITLES[n - 1]!)

test('a fresh install opens the intro at /welcome/1, with the app nowhere in sight', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await slide(page, 1)
  await expect(page).toHaveURL(/\/welcome\/1$/)
  // "Step 1 of 5" is for screen readers: in the page, but not drawn.
  await expect(page.getByTestId('welcome-step')).toHaveText('Step 1 of 5')
  const step = (await page.getByTestId('welcome-step').boundingBox())!
  expect(step.width).toBeLessThanOrEqual(1)
  // The art is an animation, not a still.
  await expect(page.getByTestId('welcome-art')).toHaveAttribute('data-static', 'false')
  await expect(page.getByTestId('welcome-next')).toHaveText('Next')
  // No ledger, no tab bar, no database.
  await expect(page.getByTestId('screen-people')).toHaveCount(0)
  expect(await databases(page)).toEqual([])
})

test('Next walks all five slides, the last says Get started and opens Continue, and it is shown once', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  for (let n = 1; n <= 5; n++) {
    await slide(page, n)
    await expect(page).toHaveURL(new RegExp(`/welcome/${n}$`))
    await expect(page.getByTestId('welcome-dot-' + n)).toHaveAttribute('aria-selected', 'true')
    if (n < 5) await page.getByTestId('welcome-next').click()
  }
  await expect(page.getByTestId('welcome-next')).toHaveText('Get started')
  await page.getByTestId('welcome-next').click()
  await expect(page.getByTestId('continue-form')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  // Once: a reload, and any other address, go straight to Continue.
  await page.reload()
  await expect(page.getByTestId('continue-form')).toBeVisible()
  await page.goto('/groups')
  await expect(page.getByTestId('continue-form')).toBeVisible()
  await expect(page.getByTestId('welcome')).toHaveCount(0)
})

test('Skip on any slide goes to Continue', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/welcome/3')
  await slide(page, 3)
  await page.getByTestId('welcome-skip').click()
  await expect(page.getByTestId('continue-form')).toBeVisible()
})

test('the dots move both ways, /welcome/N deep-links a slide and Back steps back through slides', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/welcome/4')
  await slide(page, 4)
  await page.getByTestId('welcome-dot-2').click()
  await slide(page, 2)
  await expect(page).toHaveURL(/\/welcome\/2$/)
  await page.getByTestId('welcome-dot-5').click()
  await slide(page, 5)
  await page.goBack()
  await slide(page, 2)
  await page.goBack()
  await slide(page, 4)
  // An address that names no slide is slide 1.
  await page.goto('/welcome/9')
  await slide(page, 1)
})

test('a swipe moves a slide in either direction', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  const swipe = (from: number, to: number) =>
    page.evaluate(
      ([x0, x1]) => {
        const el = document.querySelector('[data-testid="welcome"]')!
        const touch = (x: number) => new Touch({identifier: 1, target: el, pageX: x, pageY: 400, clientX: x, clientY: 400})
        el.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, touches: [touch(x0!)], changedTouches: [touch(x0!)]}))
        el.dispatchEvent(new TouchEvent('touchend', {bubbles: true, touches: [], changedTouches: [touch(x1!)]}))
      },
      [from, to],
    )
  await swipe(300, 100)
  await slide(page, 2)
  await swipe(300, 100)
  await slide(page, 3)
  await swipe(100, 300)
  await slide(page, 2)
  // A short drag is not a swipe.
  await swipe(200, 180)
  await slide(page, 2)
})

test('a vertical or diagonal drag is not a swipe; a horizontal one is followed by the slide', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  const touch = (type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) =>
    page.evaluate(
      ([type, x, y]) => {
        const el = document.querySelector('[data-testid="welcome"]')!
        const t = new Touch({identifier: 1, target: el, pageX: x as number, pageY: y as number, clientX: x as number, clientY: y as number})
        el.dispatchEvent(new TouchEvent(type as string, {bubbles: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t]}))
      },
      [type, x, y],
    )
  // Mostly downward: a scroll, not a page turn.
  await touch('touchstart', 200, 200)
  await touch('touchend', 120, 420)
  await slide(page, 1)
  // Diagonal (about 45 degrees): still not.
  await touch('touchstart', 300, 300)
  await touch('touchend', 200, 400)
  await slide(page, 1)
  // Horizontal: the slide follows the finger while it is down.
  await touch('touchstart', 300, 300)
  await touch('touchmove', 230, 304)
  const moved = await page.getByTestId('welcome-slide').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)
  expect(moved).toBeLessThan(-40)
  await touch('touchend', 150, 306)
  await slide(page, 2)
})

test('the language chip is on the first slide only and switches the intro live', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await expect(page.getByTestId('app-language')).toBeVisible()
  await page.getByTestId('app-language').click()
  await page.getByTestId('app-language-hi').click()
  await expect(page.getByTestId('welcome-title')).toHaveText('किसी के साथ भी कुछ भी बांटें')
  await expect(page.getByTestId('welcome-skip')).toContainText('छोड़ें')
  await page.getByTestId('welcome-next').click()
  await expect(page.getByTestId('app-language')).toHaveCount(0)
  // The choice survives a reload (the device's, while signed out).
  await page.reload()
  await expect(page.getByTestId('welcome-title')).not.toHaveText(TITLES[1]!)
})

test('Escape closes the open language list first, and only then skips the intro', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  await slide(page, 1)
  await page.getByTestId('app-language').click()
  await expect(page.getByTestId('app-language-hi')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('app-language-hi')).toHaveCount(0)
  await slide(page, 1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('continue-form')).toBeVisible()
})

test('reduced motion shows a still frame of the art', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'})
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await expect(page.getByTestId('welcome-art')).toHaveAttribute('data-static', 'true')
})

test('Escape skips the intro', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/welcome/2')
  await slide(page, 2)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('continue-form')).toBeVisible()
})

test('phone: full screen with Skip top right; desktop: a centred 560 px card', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await slide(page, 1)
  const phone = (await page.getByTestId('welcome').boundingBox())!
  expect(phone.x).toBe(0)
  expect(phone.width).toBe(PHONE.width)
  const skip = (await page.getByTestId('welcome-skip').boundingBox())!
  expect(skip.x + skip.width).toBeGreaterThan(PHONE.width * 0.8)
  expect(skip.y).toBeLessThan(100)

  await page.setViewportSize(DESKTOP)
  await expect.poll(async () => (await page.getByTestId('welcome').boundingBox())!.width).toBeLessThan(600)
  const card = (await page.getByTestId('welcome').boundingBox())!
  expect(card.width).toBeLessThanOrEqual(560)
  expect(card.width).toBeGreaterThan(400)
  expect(Math.abs(card.x + card.width / 2 - DESKTOP.width / 2)).toBeLessThan(2)
  expect(Math.abs(card.y + card.height / 2 - DESKTOP.height / 2)).toBeLessThan(2)
})

test('320 px in Hindi: every slide fits, with no sideways scroll', async ({page}) => {
  await page.setViewportSize({width: 320, height: 640})
  await page.goto('/')
  await page.getByTestId('app-language').click()
  await page.getByTestId('app-language-hi').click()
  for (let n = 1; n <= 5; n++) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
    const next = (await page.getByTestId('welcome-next').boundingBox())!
    expect(next.y + next.height).toBeLessThanOrEqual(640)
    if (n < 5) await page.getByTestId('welcome-next').click()
  }
})

test('screen readers: each title is a heading and the dots are tabs named by their slide', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await expect(page.getByRole('heading', {name: TITLES[0]})).toBeVisible()
  await expect(page.getByRole('tab', {name: /Slide 1 of 5/})).toHaveAttribute('aria-selected', 'true')
  const dot = (await page.getByTestId('welcome-dot-3').boundingBox())!
  expect(dot.width).toBeGreaterThanOrEqual(44)
  expect(dot.height).toBeGreaterThanOrEqual(44)
})

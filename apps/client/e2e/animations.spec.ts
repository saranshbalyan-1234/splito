import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/* The motion layer wired into the shell: illustrations, counting totals, row animations, skeletons, press scale. */

type Splito = {
  me: string
  createPerson: (name: string) => Promise<string>
  createExpense: (draft: unknown) => Promise<string>
  setPref: (key: string, value: unknown) => Promise<void>
}

async function ready(page: Page, path: string, testID: string, demo = false) {
  if (demo) await openDemo(page, path)
  else await page.goto(path)
  await expect(page.getByTestId(testID)).toBeVisible()
  await page.waitForFunction(() => 'splito' in window)
}

function setMotion(page: Page, value: 'full' | 'reduced' | 'off') {
  return page.evaluate(
    v => (window as unknown as {splito: Splito}).splito.setPref('motion', v),
    value,
  )
}

/**
 * Adds a friend and a ₹1,000 expense I paid, split with them, and returns
 * every text the INR total showed while it changed.
 */
async function addExpenseAndWatchTotal(page: Page) {
  return page.evaluate(async () => {
    const {splito} = window as unknown as {splito: Splito}
    const host = document.querySelector('[data-testid="summary-INR-net"]')!
    const seen: string[] = []
    const observer = new MutationObserver(() => {
      const text = host.textContent ?? ''
      if (seen.at(-1) !== text) seen.push(text)
    })
    observer.observe(host, {
      subtree: true,
      characterData: true,
      childList: true,
    })
    const friend = await splito.createPerson('Zoe Park')
    await splito.createExpense({
      title: 'Cab',
      groupId: null,
      currency: 'INR',
      total: '100000',
      payers: {[splito.me]: '100000'},
      split: {mode: 'equal', participants: [splito.me, friend]},
      date: '2026-10-20',
      tz: 'Asia/Kolkata',
      category: 'transport',
      notes: '',
    })
    await new Promise(r => setTimeout(r, 1200))
    observer.disconnect()
    return seen
  })
}

/** True if a CSS animation runs on the row (or a wrapper of it) within the next half second. */
function rowAnimates(page: Page, testID: string) {
  return page.evaluate(
    id =>
      new Promise<boolean>(resolve => {
        const start = performance.now()
        const tick = () => {
          const row = document.querySelector(`[data-testid="${id}"]`)
          if (
            row &&
            document
              .getAnimations()
              .some(
                a =>
                  a.effect instanceof KeyframeEffect &&
                  a.effect.target instanceof Element &&
                  (a.effect.target === row || a.effect.target.contains(row)),
              )
          )
            return resolve(true)
          if (performance.now() - start > 500) return resolve(false)
          requestAnimationFrame(tick)
        }
        tick()
      }),
    testID,
  )
}

test('empty People, Groups and Activity show their animated illustration', async ({
  page,
}) => {
  for (const [path, id] of [
    ['/', 'people-empty'],
    ['/groups', 'groups-empty'],
    ['/activity', 'activity-empty'],
  ] as const) {
    await page.goto(path)
    const art = page.getByTestId(`${id}-illustration`)
    await expect(art).toBeVisible()
    await expect(art).toHaveAttribute('data-static', 'false')
    await expect(art.locator('svg')).toHaveCount(1)
  }
})

test('the OS reduce-motion setting freezes illustrations', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'})
  await page.goto('/')
  await expect(page.getByTestId('people-empty-illustration')).toHaveAttribute(
    'data-static',
    'true',
  )
})

test('the Animations preference freezes illustrations without a reload', async ({
  page,
}) => {
  await ready(page, '/', 'people-empty-illustration')
  await setMotion(page, 'off')
  await expect(page.getByTestId('people-empty-illustration')).toHaveAttribute(
    'data-static',
    'true',
  )
  await setMotion(page, 'full')
  await expect(page.getByTestId('people-empty-illustration')).toHaveAttribute(
    'data-static',
    'false',
  )
})

test('a balance total counts to its new value and lands exactly on it', async ({
  page,
}) => {
  await ready(page, '/', 'summary-INR-net', true)
  const before = await page.getByTestId('summary-INR-net').innerText()
  const seen = await addExpenseAndWatchTotal(page)
  const after = await page.getByTestId('summary-INR-net').innerText()
  console.log('FRAMES', JSON.stringify(seen))
  expect(after).not.toBe(before)
  expect(seen.length).toBeGreaterThan(5)
  expect(seen.at(-1)).toBe(after)
  // Every frame is a formatted amount in the same currency, never a raw number.
  for (const frame of seen) expect(frame).toMatch(/^₹[\d,]+\.\d{2}$/)
  // A fresh render (nothing to animate from) shows the same final figure.
  await page.reload()
  await expect(page.getByTestId('summary-INR-net')).toHaveText(after)
})

test('with Animations off a total changes in one step', async ({page}) => {
  await ready(page, '/', 'summary-INR-net', true)
  await setMotion(page, 'off')
  const seen = await addExpenseAndWatchTotal(page)
  expect(seen).toHaveLength(1)
  await expect(page.getByTestId('summary-INR-net')).toHaveText(seen[0]!)
})

test('rows on screen at load appear at once; a new row animates in', async ({
  page,
}) => {
  await ready(page, '/', 'person-Arjun Mehta', true)
  expect(await rowAnimates(page, 'person-Arjun Mehta')).toBe(false)
  const id = page.evaluate(() =>
    (window as unknown as {splito: Splito}).splito.createPerson('Nina Rossi'),
  )
  expect(await rowAnimates(page, 'person-Nina Rossi')).toBe(true)
  await id
})

test('with Animations off a new row just appears', async ({page}) => {
  await ready(page, '/', 'person-Arjun Mehta', true)
  await setMotion(page, 'off')
  const id = page.evaluate(() =>
    (window as unknown as {splito: Splito}).splito.createPerson('Nina Rossi'),
  )
  expect(await rowAnimates(page, 'person-Nina Rossi')).toBe(false)
  await id
})

test('skeletons show while the local store loads', async ({page}) => {
  /* Records every skeleton that reaches the DOM, across page loads. */
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const seen = new Set<string>(
        JSON.parse(sessionStorage.getItem('skeletonsSeen') ?? '[]'),
      )
      for (const el of document.querySelectorAll('[data-testid$="-loading"]'))
        seen.add(el.getAttribute('data-testid')!)
      sessionStorage.setItem('skeletonsSeen', JSON.stringify([...seen]))
    }).observe(document, {subtree: true, childList: true})
  })
  for (const [path, screen] of [
    ['/', 'person-Arjun Mehta'],
    ['/groups', 'group-Goa trip'],
    ['/activity', 'screen-activity'],
    ['/profile', 'profileHeaderDisplayName'],
  ] as const) {
    await openDemo(page, path)
    await expect(page.getByTestId(screen).first()).toBeVisible()
  }
  const seen: string[] = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('skeletonsSeen') ?? '[]'),
  )
  expect(seen.sort()).toEqual([
    'activity-loading',
    'groups-loading',
    'people-loading',
    'profile-loading',
  ])
  // Loading never lingers once data is in.
  await expect(page.locator('[data-testid$="-loading"]')).toHaveCount(0)
})

test.describe('touch screens', () => {
  test.use({
    viewport: {width: 390, height: 844},
    hasTouch: true,
    isMobile: true,
  })

  test('a row shrinks slightly while pressed and springs back', async ({
    page,
  }) => {
    await ready(page, '/', 'person-Arjun Mehta', true)
    const row = page.getByTestId('person-Arjun Mehta')
    // The demo list has 39 friends: bring this one on screen before pressing it.
    await row.scrollIntoViewIfNeeded()
    const content = row.locator('> div').first()
    const scale = () => content.evaluate(el => getComputedStyle(el).transform)
    // The demo's Overview holds more currencies now, so the row can sit below the fold.
    await row.scrollIntoViewIfNeeded()
    const box = (await row.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect.poll(scale).toBe('matrix(0.98, 0, 0, 0.98, 0, 0)')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 200)
    await page.mouse.up()
    await expect.poll(scale).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
  })
})

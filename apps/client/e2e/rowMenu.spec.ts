import {type Browser, type BrowserContext, expect, type Locator, type Page, test, webkit} from '@playwright/test'

/*
 * Consolidation finding 5 (P0-b): one RowMenu opens a row's "more actions" menu by right-click, the Menu key and
 * long-press. iOS Safari fires no `contextmenu` on a long-press, so at phone width the long-press itself must open it,
 * on a history row (live and deleted), an Activity row, a disputed row and a comment, in Chromium with touch emulation
 * and in WebKit.
 */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createExpense(draft: unknown): Promise<string>
  deleteExpense(id: string): Promise<void>
  commentAs(authorId: string, input: {targetType: string; targetId: string; body: string; mentions?: string[]}): Promise<string>
  disputeAs(authorId: string, input: unknown): Promise<string>
}

const PHONE = {width: 390, height: 844}
const DESKTOP = {width: 1440, height: 900}
const PORT = Number(process.env.E2E_PORT ?? 8081)
const STORAGE = `.auth/e2e-${PORT}.json`
const BASE = {currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: '', date: '2026-10-20'}

/** Bela with a live expense, a disputed one, a deleted one and a comment on the live one. */
async function seed(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  return page.evaluate(async base => {
    const s = (window as unknown as {splito: Splito}).splito
    const bela = await s.createPerson('Bela Joshi')
    const draft = (title: string, total: string) => ({
      ...base,
      title,
      groupId: null,
      total,
      payers: {[s.me]: total},
      split: {mode: 'equal', participants: [s.me, bela]},
    })
    const live = await s.createExpense(draft('Live dinner', '120000'))
    const disputed = await s.createExpense(draft('Disputed cab', '90000'))
    const gone = await s.createExpense(draft('Deleted lunch', '60000'))
    await s.disputeAs(bela, {targetType: 'expense', targetId: disputed, reason: 'other', note: 'x'})
    await s.deleteExpense(gone)
    await s.commentAs(bela, {targetType: 'expense', targetId: live, body: 'Long press me'})
    return {bela, live, disputed, gone}
  }, BASE)
}

/**
 * A finger resting on `target` for `ms`, `whileDown` checked before it lifts: real touch input over CDP in Chromium;
 * WebKit has no touch protocol, so it gets the touch events a finger would send (the responder system listens to
 * touchstart / touchend).
 * The check runs with the finger still down: Chromium's emulated touch sends a click at the lift point, which lands on
 * the menu's scrim and closes it, as no real long-press does.
 */
async function longPress(page: Page, target: Locator, whileDown: () => Promise<void>, ms = 800) {
  await target.scrollIntoViewIfNeeded()
  const box = (await target.boundingBox())!
  const at = {x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2)}
  if (page.context().browser()?.browserType().name() === 'chromium') {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [at]})
    await page.waitForTimeout(ms)
    await whileDown()
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []})
    await cdp.detach()
    return
  }
  /* Desktop WebKit has a Touch type it will not construct, so the events carry plain touch objects (what the responder reads). */
  await page.evaluate(
    ({x, y}) => {
      const el = document.elementFromPoint(x, y)!
      const touch = {identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y, force: 1}
      const fire = (type: string, touches: object[]) => {
        const e = new Event(type, {bubbles: true, cancelable: true})
        Object.defineProperties(e, {touches: {value: touches}, targetTouches: {value: touches}, changedTouches: {value: [touch]}})
        el.dispatchEvent(e)
      }
      fire('touchstart', [touch])
      ;(window as unknown as {__finger: () => void}).__finger = () => fire('touchend', [])
    },
    at,
  )
  await page.waitForTimeout(ms)
  await whileDown()
  await page.evaluate(() => (window as unknown as {__finger: () => void}).__finger())
}

const activityActions = (page: Page) => page.locator('[data-testid^="activity-menu-"]').first()

function suite(title: string, openBrowser: (chrome: Browser) => Promise<Browser>) {
  test.describe(`long-press at 390, ${title}`, () => {
    let browser: Browser
    let context: BrowserContext
    let page: Page
    let ids: Awaited<ReturnType<typeof seed>>

    test.beforeEach(async ({browser: chrome}) => {
      browser = await openBrowser(chrome)
      context = await browser.newContext({viewport: PHONE, hasTouch: true, isMobile: true, baseURL: `http://localhost:${PORT}`, storageState: STORAGE})
      page = await context.newPage()
      ids = await seed(page)
    })
    test.afterEach(async () => {
      await context.close()
      /* The config's Chrome is the runner's to close; a WebKit launched here is ours. */
      if (browser.browserType().name() === 'webkit') await browser.close()
    })

    test('a live history row opens Report a problem, with no "..." button on the phone', async () => {
      await page.goto(`/people/${ids.bela}`)
      const row = page.getByTestId(`history-${ids.live}`)
      await expect(row).toBeVisible()
      await expect(page.getByTestId(`history-${ids.live}-record-menu`)).toHaveCount(0)
      await longPress(page, row, async () => {
        await expect(page.getByTestId('record-report')).toBeVisible()
        await expect(page.getByTestId('record-dispute')).toHaveCount(0)
        await expect(page.getByTestId('record-hold')).toHaveCount(0)
      })
    })

    test('a disputed row opens its menu too', async () => {
      await page.goto(`/people/${ids.bela}`)
      const row = page.getByTestId(`history-${ids.disputed}`)
      await expect(row).toBeVisible()
      await longPress(page, row, () => expect(page.getByTestId('record-report')).toBeVisible())
    })

    test('a deleted history row opens Hide', async () => {
      await page.goto(`/people/${ids.bela}`)
      const row = page.getByTestId(`history-${ids.gone}`)
      await expect(row).toBeVisible()
      await longPress(page, row, () => expect(page.getByTestId(`history-${ids.gone}-more-hide`)).toBeVisible())
    })

    test('an Activity row opens its actions', async () => {
      await page.goto('/activity')
      const row = page.getByTestId('screen-activity').getByTestId('activity-expense.created').first()
      await expect(row).toBeVisible()
      await longPress(page, row, () => expect(activityActions(page)).toBeVisible())
    })

    test('a comment opens Copy text', async () => {
      await page.goto(`/expense/${ids.live}`)
      const bubble = page.getByTestId('comment-bubble').filter({hasText: 'Long press me'})
      await expect(bubble).toBeVisible()
      await longPress(page, bubble, () => expect(page.getByTestId('comment-copy')).toBeVisible())
    })
  })
}

suite('chromium touch', async chrome => chrome)
/* The config runs Chrome; WebKit is the engine iOS Safari uses (the config's `channel` is Chrome-only, so it is cleared). */
suite('webkit', () => webkit.launch({channel: undefined}))

test.describe('wide screens', () => {
  test.use({viewport: DESKTOP})

  test('right-click, the Menu key and the "..." button open a history row menu; a deleted row keeps its Hide button', async ({page}) => {
    const ids = await seed(page)
    await page.goto(`/people/${ids.bela}`)
    const live = page.getByTestId(`history-${ids.live}`)
    await live.click({button: 'right'})
    await expect(page.getByTestId('record-report')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('record-report')).toHaveCount(0)

    await live.focus()
    await page.keyboard.press('Shift+F10')
    await expect(page.getByTestId('record-report')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByTestId(`history-${ids.live}-record-menu`).click()
    await expect(page.getByTestId('record-report')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByTestId(`history-${ids.gone}-more`).click()
    await expect(page.getByTestId(`history-${ids.gone}-more-hide`)).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByTestId(`history-${ids.gone}`).click({button: 'right'})
    await expect(page.getByTestId(`history-${ids.gone}-more-hide`)).toBeVisible()
  })

  test('a held mouse button does not open the menu on a wide screen; right-click on an Activity row does', async ({page}) => {
    const ids = await seed(page)
    await page.goto(`/people/${ids.bela}`)
    await page.getByTestId(`history-${ids.live}`).hover()
    await page.mouse.down()
    await page.waitForTimeout(900)
    await page.mouse.up()
    await expect(page.getByTestId('record-report')).toHaveCount(0)
    await page.goto('/activity')
    const row = page.getByTestId('screen-activity').getByTestId('activity-expense.created').first()
    await row.click({button: 'right'})
    await expect(activityActions(page)).toBeVisible()
  })
})

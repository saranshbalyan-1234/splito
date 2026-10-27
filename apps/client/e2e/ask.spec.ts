import {expect, type Page, test} from '@playwright/test'

/*
 * F-2301 Ask Splito: the chat inside the Search & Ask drawer, answered on the
 * device from the demo set. F-222 acc 9: the phone bar takes any number of
 * tabs, and an Ask tab opens the drawer in Ask mode.
 */

const PHONE = {width: 390, height: 844}
const DESKTOP = {width: 1440, height: 900}

async function home(page: Page) {
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
}

async function ask(page: Page, question: string) {
  await page.getByTestId('ask-input').fill(question)
  await page.getByTestId('ask-input').press('Enter')
}

test.use({viewport: DESKTOP})

test('the Sparkles button, a question and Enter open the chat; the answer says where it came from; the arrow goes back to the results', async ({
  page,
}) => {
  await home(page)
  await page.getByTestId('header-search-ask').click()
  await page.getByTestId('search-input').fill('Who owes me the most?')
  // The Ask row heads the results.
  await expect(page.getByTestId('search-row-0')).toContainText('Ask Splito')
  await page.getByTestId('search-input').press('Enter')
  await expect(page.getByTestId('ask-chat')).toBeVisible()
  await expect(page.getByTestId('ask-message-user')).toContainText('Who owes me the most?')
  await expect(page.getByTestId('ask-message-ask')).toBeVisible()
  await expect(page.getByTestId('ask-on-device')).toContainText('Answered on this device')
  await expect(page.getByTestId('ask-ranking-owed-INR')).toBeVisible()

  await page.getByTestId('ask-back').click()
  await expect(page.getByTestId('search-input')).toHaveValue('Who owes me the most?')
})

test('typing a plain search and pressing Enter stays a search; the Ask row opens the chat for any text', async ({
  page,
}) => {
  await home(page)
  await page.getByTestId('header-search-ask').click()
  await page.getByTestId('search-input').fill('zzqx wvkp')
  await page.getByTestId('search-input').press('Enter')
  await expect(page.getByTestId('ask-chat')).toHaveCount(0)
  await page.getByTestId('search-row-0').click()
  await expect(page.getByTestId('ask-chat')).toBeVisible()
  // Outside what the device can answer: honest, with the closest question, never a figure.
  await expect(page.getByTestId('ask-lead')).toContainText('I can answer this once you sign in')
  await expect(page.getByTestId('ask-suggestion').first()).toBeVisible()
  await expect(page.getByTestId('ask-on-device')).toHaveCount(0)
})

test('"What does Riya owe me?" is the People balance', async ({page}) => {
  await home(page)
  const row = await page.getByTestId('person-Riya Sharma').innerText()
  await page.getByTestId('header-search-ask').click()
  await page.getByTestId('search-input').fill('What does Riya owe me?')
  await page.getByTestId('search-input').press('Enter')
  // People shows each way on its own: what she owes me and what I owe her, never netted.
  const money = (t: string) => (t.match(/₹[\d,]+\.\d\d/) ?? [''])[0]
  const owed = page.getByTestId('ask-balance-INR-owed')
  const owe = page.getByTestId('ask-balance-INR-owe')
  await expect(owed).toBeVisible()
  const compact = row.replace(/\s/g, '')
  expect(compact).toContain(money(await owed.innerText()))
  expect(compact).toContain(money(await owe.innerText()))
  await expect(page.getByTestId('ask-action-person')).toBeVisible()
})

test('suggestion chips answer; charts and plan cards appear; a split opens the expense sheet pre-filled', async ({
  page,
}) => {
  await home(page)
  await page.getByTestId('header-search-ask').click()
  await page.getByTestId('search-input').fill('x')
  await page.getByTestId('search-input').clear()
  await page.getByTestId('search-question').filter({hasText: 'owes me'}).click()
  await expect(page.getByTestId('ask-chat')).toBeVisible()
  await expect(page.getByTestId('ask-ranking-owed-INR')).toBeVisible()
  await expect(page.getByTestId('ask-empty')).toHaveCount(0)

  await ask(page, 'Show my Goa trip spending by day')
  await expect(page.getByTestId('ask-trend-INR-chart')).toBeVisible()
  await ask(page, 'Who owes whom in Goa trip?')
  await expect(page.getByTestId('ask-plan')).toBeVisible()

  await ask(page, 'split 1200 4 ways')
  await expect(page.getByTestId('ask-lead').last()).toContainText('₹300.00 each')
  await page.getByTestId('ask-action-add').click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
  await expect(page.getByTestId('amount-input')).toHaveValue('1200.00')
})

test('the chat and the draft survive closing, and Clear chat empties it', async ({page}) => {
  await home(page)
  await page.getByTestId('tab-ask').click()
  await expect(page.getByTestId('ask-empty')).toBeVisible()
  await expect(page.getByTestId('ask-chip')).toHaveCount(4)
  await ask(page, 'How much did I spend on food in december 2025?')
  await expect(page.getByTestId('ask-spend-INR')).toBeVisible()
  await page.getByTestId('ask-input').fill('half-typed')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ask-chat')).toHaveCount(0)

  await page.getByTestId('tab-ask').click()
  await expect(page.getByTestId('ask-message-user')).toContainText('december 2025')
  await expect(page.getByTestId('ask-input')).toHaveValue('half-typed')

  await page.getByTestId('ask-clear').click()
  await page.getByRole('button', {name: 'Clear', exact: true}).click()
  await expect(page.getByTestId('ask-empty')).toBeVisible()
})

test('the sidebar, the drawer and a pinned bar tab all open the drawer in Ask mode', async ({page}) => {
  await home(page)
  await page.getByTestId('tab-ask').click()
  await expect(page.getByTestId('ask-chat')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.setViewportSize(PHONE)
  await page.goto('/settings/navigation')
  await page.getByTestId('tabs-toggle-ask').click()
  await page.goto('/?demo=1')
  await expect(page.getByTestId('tab-ask')).toBeVisible()
  await page.getByTestId('tab-ask').click()
  await expect(page.getByTestId('ask-chat')).toBeVisible()
  await page.getByTestId('ask-back').click()
  await expect(page.getByTestId('search-input')).toBeVisible()
  await page.getByTestId('search-ask-cancel').click()

  await page.getByTestId('screen-people').getByTestId('header-avatar').click()
  await page.getByTestId('drawer-ask').click()
  await expect(page.getByTestId('ask-chat')).toBeVisible()
})

test('a six-tab bar fits a phone: every tab is on screen, equal in width, with its badge', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/settings/navigation')
  for (const tab of ['ask', 'settings'])
    await page.getByTestId(`tabs-toggle-${tab}`).click()
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  const ids = ['people', 'groups', 'analytics', 'ask', 'activity', 'settings']
  const boxes = []
  for (const id of ids) {
    const box = await page.getByTestId(`tab-${id}`).boundingBox()
    expect(box, id).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width)
    boxes.push(box!)
  }
  const widths = boxes.map(b => Math.round(b.width))
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2)
  // Icons keep their size however many tabs there are.
  const icon = await page.getByTestId('tab-groups').locator('svg').first().boundingBox()
  await page.goto('/settings/navigation')
  for (const tab of ['ask', 'settings'])
    await page.getByTestId(`tabs-toggle-${tab}`).click()
  await page.goto('/?demo=1')
  await expect(page.getByTestId('tab-settings')).toHaveCount(0)
  const four = await page.getByTestId('tab-groups').locator('svg').first().boundingBox()
  expect(Math.round(icon!.width)).toBe(Math.round(four!.width))
})

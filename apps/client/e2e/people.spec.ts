import {expect, type Page, test} from '@playwright/test'

/* Seeds through the app's own mutations (window.splito, dev/E2E builds only). Amounts are minor units. */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
  setPref(key: string, value: unknown): Promise<void>
}

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
}

/** A04: Kavya owes me 100 directly and 50 in a shared group. */
async function seedA04(page: Page) {
  return page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const kavya = await s.createPerson('Kavya Rao')
    const group = await s.createGroup({name: 'Pune trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [kavya]})
    const base = {currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: ''}
    await s.createExpense({...base, title: 'Concert', groupId: null, total: '20000', payers: {[s.me]: '20000'}, split: {mode: 'equal', participants: [s.me, kavya]}, date: '2026-10-20'})
    await s.createExpense({...base, title: 'Snacks', groupId: group, total: '10000', payers: {[s.me]: '10000'}, split: {mode: 'equal', participants: [s.me, kavya]}, date: '2026-10-21'})
    return kavya
  })
}

test('A04: direct 100 + group 50 = 150; Include groups off = 100, totals and history', async ({page}) => {
  await ready(page)
  const kavya = await seedA04(page)
  await page.goto(`/people/${kavya}`)

  await expect(page.getByTestId('person-name')).toHaveText('Kavya Rao')
  await expect(page.getByTestId('person-direction-INR')).toHaveText('Kavya Rao owes you')
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await expect(page.getByTestId('person-part-INR-direct')).toContainText('+₹100.00')
  await expect(page.getByTestId('person-history-title')).toHaveText('History  2')
  await expect(page.getByText('Snacks')).toBeVisible()

  await page.getByTestId('person-filter').click()
  await page.getByTestId('filter-include-groups').click()
  // Nothing changes before Apply.
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await page.getByTestId('filter-apply').click()

  await expect(page.getByTestId('person-total-INR')).toHaveText('₹100.00')
  await expect(page.getByTestId('person-history-title')).toHaveText('History  1')
  await expect(page.getByText('Direct only')).toBeVisible()
  await expect(page.getByText('Snacks')).toHaveCount(0)
  await expect(page.getByText('Concert')).toBeVisible()
  await expect(page.getByText('owes you ₹100.00')).toBeVisible()
})

test('the Include groups default comes from preferences', async ({page}) => {
  await ready(page)
  const kavya = await seedA04(page)
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.setPref('includeGroupsDefault', false))
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹100.00')
  await expect(page.getByText('Direct only')).toBeVisible()
})

test('recording a part payment moves the balance; deleting it is undoable', async ({page}) => {
  await ready(page)
  const kavya = await seedA04(page)
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')

  await page.getByTestId('person-record-payment').click()
  await expect(page.getByTestId('payment-sentence')).toHaveText('Kavya Rao paid you')
  await expect(page.getByTestId('payment-amount')).toHaveValue('150.00')
  await page.getByTestId('payment-amount').fill('40')
  await page.getByTestId('payment-note').fill('Cash')
  await page.getByTestId('payment-save').click()
  await expect(page.getByTestId('payment-recorded')).toBeVisible()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹110.00')

  const row = page.getByRole('button', {name: 'Kavya Rao paid you'})
  await expect(row).toContainText('₹40.00')
  await expect(row).toContainText('Payment · Cash')
  await row.click()
  await expect(page.getByTestId('payment-details-amount')).toHaveText('₹40.00')
  await page.getByTestId('payment-delete').click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await page.getByRole('button', {name: 'Undo'}).click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹110.00')
})

test('swapping the direction records what I paid them', async ({page}) => {
  await ready(page)
  const kavya = await seedA04(page)
  await page.goto(`/people/${kavya}`)
  await page.getByTestId('person-record-payment').click()
  await page.getByTestId('payment-swap').click()
  await expect(page.getByTestId('payment-sentence')).toHaveText('You paid Kavya Rao')
  await page.getByTestId('payment-amount').fill('25')
  await page.getByTestId('payment-save').click()
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹175.00')
})

test('UPI pay link shows only when I owe them rupees, and asks before recording', async ({page}) => {
  await ready(page)
  const [owedINR, owedUSD] = await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const a = await s.createPerson('Meera Iyer')
    const b = await s.createPerson('Tom Hale')
    const base = {groupId: null, tz: 'Asia/Kolkata', category: 'food', notes: '', date: '2026-10-20'}
    await s.createExpense({...base, title: 'Lunch', currency: 'INR', total: '30000', payers: {[a]: '30000'}, split: {mode: 'equal', participants: [s.me, a]}})
    await s.createExpense({...base, title: 'Taxi', currency: 'USD', total: '3000', payers: {[b]: '3000'}, split: {mode: 'equal', participants: [s.me, b]}})
    return [a, b]
  })

  await page.goto(`/people/${owedUSD}`)
  await expect(page.getByTestId('person-direction-USD')).toHaveText('You owe Tom Hale')
  await expect(page.getByTestId('person-upi')).toHaveCount(0)

  await page.goto(`/people/${owedINR}`)
  await expect(page.getByTestId('person-direction-INR')).toHaveText('You owe Meera Iyer')
  await page.getByTestId('person-upi').click()
  await expect(page.getByTestId('upi-amount')).toHaveValue('150.00')
  await page.getByTestId('upi-open').click()
  await expect(page.getByText('Enter a UPI ID like name@bank.')).toBeVisible()
  await page.getByTestId('upi-id').fill('meera@okhdfc')
  // Keep the page here: record the UPI link instead of handing it to the OS.
  await page.evaluate(() =>
    document.addEventListener(
      'click',
      e => {
        const link = (e.target as Element).closest?.('a[href^="upi:"]')
        if (!link) return
        e.preventDefault()
        ;(window as unknown as {upiLink: string}).upiLink = link.getAttribute('href')!
      },
      true,
    ),
  )
  await page.getByTestId('upi-open').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as {upiLink?: string}).upiLink)).toBe(
    'upi://pay?pa=meera%40okhdfc&pn=Meera%20Iyer&am=150.00&cu=INR&tn=Splito',
  )
  await expect(page.getByTestId('upi-confirm')).toBeVisible()
  // Nothing is recorded until the user says it went through.
  await expect(page.getByTestId('person-total-INR')).toHaveText('₹150.00')
  await page.getByTestId('upi-mark-paid').click()
  await expect(page.getByTestId('payment-sentence')).toHaveText('You paid Meera Iyer')
  await expect(page.getByTestId('payment-amount')).toHaveValue('150.00')
  await page.getByTestId('payment-save').click()
  await expect(page.getByTestId('person-settled')).toBeVisible()
  // The UPI ID is remembered on the friend.
  await expect(page.getByText('meera@okhdfc')).toBeVisible()
})

test('add a friend, then land on their page', async ({page}) => {
  await ready(page)
  await page.goto('/friends/new')
  await page.getByTestId('add-friend-save').click()
  await expect(page.getByText('Enter a name.')).toBeVisible()
  await page.getByTestId('add-friend-name').fill('Nikhil Das')
  await page.getByTestId('add-friend-upi').fill('nikhil@ybl')
  await page.getByTestId('add-friend-save').click()
  await expect(page.getByTestId('person-name')).toHaveText('Nikhil Das')
  await expect(page.getByText('nikhil@ybl')).toBeVisible()
  await expect(page.getByTestId('person-settled')).toBeVisible()
  await expect(page.getByTestId('person-history-empty')).toBeVisible()
})

test('compose follows Bluesky: hero button on desktop, FAB with the friend on phones', async ({page}) => {
  await ready(page)
  const kavya = await seedA04(page)
  await page.setViewportSize({width: 1280, height: 800})
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('person-add-expense')).toBeVisible()
  await expect(page.getByTestId('fab-add')).toHaveCount(0)

  await page.setViewportSize({width: 390, height: 844})
  await page.goto(`/people/${kavya}`)
  await expect(page.getByTestId('person-add-expense')).toHaveCount(0)
  await page.getByTestId('screen-person').getByTestId('fab-add').click()
  await expect(page).toHaveURL(new RegExp(`/expense/new\\?personId=${kavya}`))
})

test('an unknown friend shows an honest not-found state', async ({page}) => {
  await ready(page)
  await page.goto('/people/nobody-here')
  await expect(page.getByTestId('person-not-found')).toBeVisible()
})

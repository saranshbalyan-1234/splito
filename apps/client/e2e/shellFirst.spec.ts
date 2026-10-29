import {expect, type Page, test} from '@playwright/test'

/* Owners 151/152: a push with the data already loaded shows its header and then its rows, never a skeleton in between. */
type Splito = {
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
  me: string
}

test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})

/**
 * Samples every frame and every DOM change after this call. A header skeleton (`*-loading`) is allowed only while data
 * is really missing (a group reads its own totals and history on open); a rows skeleton beside a REAL header is the
 * flash this spec exists to catch.
 */
function watchSkeletons(page: Page) {
  return page.evaluate(() => {
    const out = {rowsSkeletonUnderRealHeader: 0}
    ;(window as unknown as {__sk: typeof out}).__sk = out
    const q = (sel: string) => !!document.querySelector(sel)
    const check = () => {
      const header = q('[data-testid="group-loading"],[data-testid="person-loading"]')
      const rows = q('[data-testid="group-history-loading"],[data-testid="person-history-loading"]')
      if (rows && !header) out.rowsSkeletonUnderRealHeader++
    }
    new MutationObserver(check).observe(document.body, {subtree: true, childList: true})
    const frame = () => {
      check()
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}

const skeletons = (page: Page) =>
  page.evaluate(() => (window as unknown as {__sk: {rowsSkeletonUnderRealHeader: number}}).__sk)

test('opening a friend and a group with the data loaded shows no skeleton', async ({page}) => {
  /* People is the first page here, so Home is never mounted behind it (its Recently active lists would repeat the rows). */
  await page.goto('/people')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const friend = await s.createPerson('Bela Joshi')
    const group = await s.createGroup({name: 'Rishikesh', kind: 'trip', currency: 'INR', startDate: '2026-09-04', endDate: '2026-09-07', memberIds: [friend]})
    await s.createExpense({
      title: 'Rafting',
      groupId: group,
      currency: 'INR',
      total: '10000',
      payers: {[friend]: '10000'},
      split: {mode: 'equal', participants: [s.me]},
      date: '2026-09-05',
      tz: 'Asia/Kolkata',
      category: 'entertainment',
      notes: '',
    })
  })
  await expect(page.getByTestId('person-Bela Joshi')).toBeVisible()
  // Visit Groups once so its data is hot too, then come back to People.
  await page.getByTestId('tab-groups').click()
  await expect(page.getByTestId('group-Rishikesh')).toBeVisible()
  await page.waitForTimeout(1000)

  await watchSkeletons(page)
  await page.getByTestId('group-Rishikesh').tap()
  await expect(page.getByTestId('screen-group')).toBeVisible()
  await expect(page.getByTestId('group-tabs')).toBeVisible()
  await expect(page.getByText('Rafting').first()).toBeVisible()
  await page.waitForTimeout(500)
  expect((await skeletons(page)).rowsSkeletonUnderRealHeader).toBe(0)

  await page.goBack()
  await page.getByTestId('tab-home').click()
  await expect(page.getByTestId('person-Bela Joshi')).toBeVisible()
  await page.waitForTimeout(1000)
  await watchSkeletons(page)
  await page.getByTestId('person-Bela Joshi').tap()
  await expect(page.getByTestId('screen-person')).toBeVisible()
  await expect(page.getByTestId('screen-person').getByText('Rafting').first()).toBeVisible()
  await page.waitForTimeout(500)
  expect((await skeletons(page)).rowsSkeletonUnderRealHeader).toBe(0)
})

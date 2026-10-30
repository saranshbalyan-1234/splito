import {expect, test} from '@playwright/test'

/*
 * ARCHITECTURE 9.7: the ledger never fails silently. A newer build in another
 * tab upgrading the database closes this tab's connection; the tab says so
 * and offers a reload, and the data is still there afterwards.
 */
test('a newer build taking the database over closes this tab with a Reload prompt', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window)
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: {createPerson(name: string): Promise<string>}}).splito
    await s.createPerson('Kept Friend')
  })
  // Another tab (here, another connection) asks for a newer version: this tab is told to let go.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("splito-acct-dev", 99)
        req.onupgradeneeded = () => undefined
        req.onsuccess = () => {
          req.result.close()
          resolve()
        }
        req.onerror = () => reject(req.error)
      }),
  )
  const notice = page.getByTestId('storage-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('Splito was updated in another tab')
  await expect(page.getByTestId('storage-notice-reload')).toBeVisible()
})

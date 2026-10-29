import {readFileSync} from 'node:fs'

import {expect, type Page, test} from '@playwright/test'

/* F-2001 backup/restore and F-2007 export, seeded through the app's own mutations (window.splito). */
type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
  createExpense(draft: unknown): Promise<string>
  list(type: string): Promise<Array<{id: string; deleted: boolean; data: Record<string, unknown>}>>
}

async function ready(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForFunction(() => 'splito' in window)
}

/** Kavya owes me 250.00 INR (Dinner, "=1+1" must be escaped in CSV); I owe her 5.00 EUR. */
async function seed(page: Page) {
  await page.evaluate(async () => {
    const s = (window as unknown as {splito: Splito}).splito
    const kavya = await s.createPerson('Kavya Rao')
    const base = {tz: 'Asia/Kolkata', category: 'food', notes: '', groupId: null}
    await s.createExpense({...base, currency: 'INR', title: '=1+1 Dinner', total: '50000', payers: {[s.me]: '50000'}, split: {mode: 'equal', participants: [s.me, kavya]}, date: '2026-10-20'})
    await s.createExpense({...base, currency: 'EUR', title: 'Coffee', total: '1000', payers: {[kavya]: '1000'}, split: {mode: 'equal', participants: [s.me, kavya]}, date: '2026-10-21'})
  })
}

async function exportAs(page: Page, format: 'pdf' | 'csv' | 'backup') {
  await page.goto('/settings')
  await page.getByTestId('settings-export').click()
  await page.getByTestId(`export-format-${format}`).click()
}

test('a backup exports from Settings and restores into a fresh device with the same balances', async ({page, browser}, info) => {
  await ready(page)
  await seed(page)
  await exportAs(page, 'backup')
  const download = page.waitForEvent('download')
  await page.getByTestId('sheet-save').click()
  const file = info.outputPath('backup.json')
  await (await download).saveAs(file)
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  expect(raw).toMatchObject({format: 'splito-backup', version: 1})
  expect(raw.entities.expense).toHaveLength(2)
  expect(typeof raw.checksum).toBe('string')

  // A different device: nothing there yet.
  const fresh = await browser.newContext({baseURL: info.project.use.baseURL})
  const other = await fresh.newPage()
  await ready(other)
  await other.goto('/settings')
  await other.getByTestId('settings-import').click()
  const chooser = other.waitForEvent('filechooser')
  await other.getByTestId('sheet-save').click()
  await (await chooser).setFiles(file)
  await expect(other.getByTestId('import-summary')).toBeVisible()
  await expect(other.getByTestId('import-count-expense')).toContainText('2 new')
  await expect(other.getByTestId('import-count-person')).toContainText('1 new')
  await other.getByTestId('sheet-save').click()
  await expect(other.getByText(/Restored/)).toBeVisible()
  await other.goto('/people')
  const row = other.getByTestId('person-Kavya Rao')
  await expect(row).toBeVisible()
  await expect(row.getByTestId('balance-INR')).toContainText('250.00')
  await expect(row.getByTestId('balance-EUR')).toContainText('5.00')
  // Restoring the same file again changes nothing.
  await other.goto('/settings')
  await other.getByTestId('settings-import').click()
  const again = other.waitForEvent('filechooser')
  await other.getByTestId('sheet-save').click()
  await (await again).setFiles(file)
  await expect(other.getByTestId('import-nothing')).toBeVisible()
  await expect(other.getByTestId('sheet-save')).toBeDisabled()
  await fresh.close()
})

test('a damaged backup is refused and nothing changes', async ({page}, info) => {
  await ready(page)
  await seed(page)
  await exportAs(page, 'backup')
  const download = page.waitForEvent('download')
  await page.getByTestId('sheet-save').click()
  const file = info.outputPath('good.json')
  await (await download).saveAs(file)
  const bad = info.outputPath('bad.json')
  require('node:fs').writeFileSync(bad, readFileSync(file, 'utf8').replace('"$bigint":"50000"', '"$bigint":"50001"'))

  await page.goto('/settings')
  await page.getByTestId('settings-import').click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('sheet-save').click()
  await (await chooser).setFiles(bad)
  await expect(page.getByTestId('import-error')).toContainText('damaged')
  await expect(page.getByTestId('import-error')).toContainText('Nothing was changed')
  expect(await page.evaluate(async () => ((window as unknown as {splito: Splito}).splito.list('expense')).then(r => r.length))).toBe(2)
})

test('Person > Export statement downloads a CSV with exact amounts per currency and formula-safe cells', async ({page}, info) => {
  await ready(page)
  await seed(page)
  await page.goto('/people')
  await page.getByTestId('person-Kavya Rao').click()
  await page.getByTestId('person-more').click()
  await page.getByTestId('person-export').click()
  // Opened for this friend.
  await expect(page.getByTestId('export-person')).toContainText('Kavya Rao')
  await page.getByTestId('export-format-csv').click()
  const download = page.waitForEvent('download')
  await page.getByTestId('sheet-save').click()
  const file = info.outputPath('statement.csv')
  await (await download).saveAs(file)
  const csv = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const lines = csv.trim().split('\r\n')
  expect(lines[0]).toContain('Date,Type,Description')
  expect(csv).toContain("'=1+1 Dinner")
  expect(csv).not.toMatch(/,=1\+1/)
  expect(lines.some(l => l.includes(',INR,') && l.includes('500.00'))).toBe(true)
  expect(lines.some(l => l.includes(',EUR,') && l.includes('-5.00'))).toBe(true)
  // The closing balance of each currency equals the figure on the friend's page.
  expect(csv).toMatch(/Closing balance,[^\r\n]*,INR,[^\r\n]*,250\.00\r\n/)
  expect(csv).toMatch(/Closing balance,[^\r\n]*,EUR,[^\r\n]*,-5\.00\r\n/)
})

test('the PDF statement opens a print-ready page with a table per currency', async ({page}) => {
  await ready(page)
  await seed(page)
  await exportAs(page, 'pdf')
  await page.getByTestId('sheet-save').click()
  const frame = page.frameLocator('#splito-print-frame')
  await expect(frame.locator('h1')).toHaveText('Splito statement')
  await expect(frame.locator('table')).toHaveCount(2)
  await expect(frame.locator('body')).toContainText('Closing balance')
  await expect(frame.locator('footer')).toContainText('never adds different currencies')
})

test('Replace asks for a copy of this device first, and the toast can undo it', async ({page}, info) => {
  await ready(page)
  await seed(page)
  await exportAs(page, 'backup')
  const download = page.waitForEvent('download')
  await page.getByTestId('sheet-save').click()
  const file = info.outputPath('replace.json')
  await (await download).saveAs(file)
  // A person that only exists here.
  await page.evaluate(async () => (window as unknown as {splito: Splito}).splito.createPerson('Only Here'))
  await page.goto('/settings')
  await page.getByTestId('settings-import').click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('sheet-save').click()
  await (await chooser).setFiles(file)
  await page.getByTestId('import-mode-replace').click()
  // Required step: Restore waits until a copy is saved (or skipped on a second confirm).
  await expect(page.getByTestId('import-safety')).toBeVisible()
  await expect(page.getByTestId('import-count-person')).toContainText('1 removed')
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  const copy = page.waitForEvent('download')
  await page.getByTestId('import-save-copy').click()
  expect((await copy).suggestedFilename()).toMatch(/^splito-before-restore-/)
  await expect(page.getByTestId('import-copy-saved')).toBeVisible()
  await page.getByTestId('sheet-save').click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByText(/Restored/)).toBeVisible()
  const live = () => page.evaluate(async () => ((window as unknown as {splito: Splito}).splito.list('person')).then(r => r.filter(p => !p.deleted).map(p => p.data.name)))
  expect(await live()).not.toContain('Only Here')
  await page.getByRole('button', {name: 'Undo'}).click()
  await expect.poll(live).toContain('Only Here')
})

test('Replace can skip the copy only after a second confirm', async ({page}, info) => {
  await ready(page)
  await seed(page)
  await exportAs(page, 'backup')
  const download = page.waitForEvent('download')
  await page.getByTestId('sheet-save').click()
  const file = info.outputPath('skip.json')
  await (await download).saveAs(file)
  await page.goto('/settings')
  await page.getByTestId('settings-import').click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('sheet-save').click()
  await (await chooser).setFiles(file)
  await page.getByTestId('import-mode-replace').click()
  await page.getByTestId('import-skip-copy').click()
  await expect(page.getByText('Replace without a copy?')).toBeVisible()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByText('No copy will be saved.')).toBeVisible()
})

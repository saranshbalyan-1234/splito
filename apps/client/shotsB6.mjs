import {chromium} from 'playwright'
const out = process.argv[2]
const URL = 'http://localhost:8666'
const browser = await chromium.launch({channel: 'chrome'})
const views = {phone: {width: 390, height: 844}, desktop: {width: 1440, height: 900}}
for (const [vn, viewport] of Object.entries(views)) for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({viewport, deviceScaleFactor: 2, colorScheme: scheme, isMobile: vn === 'phone', hasTouch: vn === 'phone', acceptDownloads: true})
  const page = await ctx.newPage()
  const shot = async n => { await page.waitForTimeout(1500); await page.screenshot({path: `${out}/${vn}-${scheme}-${n}.png`}); console.log('shot', vn, scheme, n) }
  const tap = async loc => (vn === 'phone' ? loc.tap() : loc.click())
  const seed = async () => {
    await page.goto(`${URL}/?demo=1`)
    await page.waitForFunction(() => document.querySelector('[data-testid="screen-people"]'), undefined, {timeout: 60000})
    await page.waitForTimeout(3500)
    await page.evaluate(() => { localStorage.setItem('splito-theme-dim', '1') }).catch(() => {})
  }
  await seed()
  await page.goto(`${URL}/settings`); await page.waitForTimeout(1500)
  await shot('01-settings')
  await tap(page.getByTestId('settings-export')); await page.waitForTimeout(600); await shot('02-export-pdf')
  await page.getByTestId('export-format-backup').click(); await shot('03-export-backup')
  const dl = page.waitForEvent('download')
  await page.getByTestId('sheet-save').click()
  const file = `${out}/backup-${vn}-${scheme}.json`
  await (await dl).saveAs(file)
  await page.waitForTimeout(800)
  await page.goto(`${URL}/settings`); await page.waitForTimeout(1000)
  await tap(page.getByTestId('settings-import')); await page.waitForTimeout(600); await shot('04-import-pick')
  const fc = page.waitForEvent('filechooser')
  await page.getByTestId('sheet-save').click()
  await (await fc).setFiles(file)
  await page.getByTestId('import-mode-replace').click().catch(() => {})
  await shot('04b-import-preview')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.goto(`${URL}/settings/friends`); await page.waitForTimeout(2500)
  await shot('05-friends-hub')
  await page.getByTestId('hub-friend-remove').first().click().catch(async () => { await page.getByTestId('hub-friend-menu').first().tap(); await page.getByTestId('hub-friend-remove').tap() })
  await page.waitForTimeout(800); await shot('06-remove-friend')
  await ctx.close()
}
await browser.close()

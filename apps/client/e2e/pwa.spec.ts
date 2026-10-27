import {expect, type Page, test} from '@playwright/test'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

/* Chrome fires this once when the app is installable; the e2e browser never does, so the spec plays it. */
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {__installPrompts: number}
    w.__installPrompts = 0
    const event = new Event('beforeinstallprompt', {cancelable: true})
    Object.assign(event, {
      prompt: async () => {
        w.__installPrompts++
      },
      userChoice: Promise.resolve({outcome: 'dismissed'}),
    })
    window.dispatchEvent(event)
  })
}

test('the e2e build never registers a service worker', async ({page}) => {
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  const count = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)
  expect(count).toBe(0)
})

test('Settings offers Install app once the browser says the app is installable', async ({page}) => {
  await page.goto('/settings')
  await expect(page.getByTestId('screen-settings')).toBeVisible()
  await expect(page.getByTestId('settings-install')).toHaveCount(0)
  await offerInstall(page)
  await expect(page.getByTestId('settings-install')).toBeVisible()
  await page.getByTestId('settings-install').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as {__installPrompts: number}).__installPrompts)).toBe(1)
})

test('a one-time hint offers the install, and never returns after it was shown', async ({page}) => {
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await offerInstall(page)
  await expect(page.getByText('Install Splito for quick access, even offline.')).toBeVisible({timeout: 15_000})
  await page.getByTestId('install-hint-action').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as {__installPrompts: number}).__installPrompts)).toBe(1)
  // Shown once: a fresh offer after a reload stays quiet.
  await page.reload()
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await offerInstall(page)
  await page.waitForTimeout(8000)
  await expect(page.getByText('Install Splito for quick access, even offline.')).toHaveCount(0)
})

/* Plays what a waiting service worker would cause; the real worker is checked in e2e-pwa on a production build. */
const updateReady = (page: Page) => page.evaluate(() => (window as unknown as {splito: {setPwa(p: object): void}}).splito.setPwa({updateReady: true}))

test('a waiting update only offers Reload; it reloads when asked', async ({page}) => {
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await updateReady(page)
  await expect(page.getByText('New version available')).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(page.getByText('New version available')).toBeVisible()
  await Promise.all([page.waitForEvent('load'), page.getByTestId('update-reload').click()])
  await expect(page.getByTestId('screen-people')).toBeVisible()
})

test('with unsaved input in a sheet, Reload asks first and Cancel keeps the offer', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
  await page.getByTestId('sidebar-add').click()
  await page.getByTestId('expense-title').fill('Dinner at Thalassa')
  await updateReady(page)
  await page.getByTestId('update-reload').click()
  await expect(page.getByText('Reload and lose your changes?')).toBeVisible()
  // The prompt's Cancel is on top of the sheet's own.
  await page.getByRole('button', {name: 'Cancel'}).last().click()
  await expect(page.getByText('Reload and lose your changes?')).toHaveCount(0)
  await expect(page.getByTestId('expense-title')).toHaveValue('Dinner at Thalassa')
  // The tapped toast leaves with its exit animation while the brought-back one arrives: wait for the one.
  await expect(page.getByTestId('update-reload')).toHaveCount(1)
  await expect(page.getByTestId('update-reload')).toBeVisible()
})

test.describe('on an iPhone', () => {
  test.use({userAgent: IPHONE_UA, viewport: {width: 390, height: 844}, hasTouch: true})

  test('Install app shows the Add to Home Screen steps', async ({page}) => {
    await page.goto('/settings')
    await expect(page.getByTestId('settings-install')).toBeVisible()
    await page.getByTestId('settings-install').click()
    const sheet = page.getByTestId('install-help-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Add Splito to your Home Screen')).toBeVisible()
    await expect(sheet.getByText('Scroll down and choose Add to Home Screen.')).toBeVisible()
    await page.getByTestId('sheet-close').click()
    await expect(sheet).toHaveCount(0)
  })

  test('the Safari warning shows once, with a way to install', async ({page}) => {
    await page.goto('/')
    await expect(page.getByText('Safari can erase Splito’s saved data after 7 days away', {exact: false})).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId('install-hint-action').click()
    await expect(page.getByTestId('install-help-sheet')).toBeVisible()
  })
})

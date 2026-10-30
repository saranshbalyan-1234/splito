import {mkdirSync} from 'node:fs'
import {join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

import {continueWith, devCode, toContinue} from './auth'
import {signedOut} from './signedOut'

/* F-249/F-250 screenshots for review: the intro slides and the Continue flow, light and Dim, phone and desktop, into the gitignored qa/auth/. */
test.use(signedOut)

const OUT = join(__dirname, '..', 'qa', 'auth')
mkdirSync(OUT, {recursive: true})
const SIZES = {'390': {width: 390, height: 844}, '1440': {width: 1440, height: 900}}
const THEMES = {light: 'light', dim: 'dark'} as const

for (const [size, viewport] of Object.entries(SIZES)) {
  for (const [name, scheme] of Object.entries(THEMES)) {
    test(`auth screens, ${name} ${size}`, async ({page}) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({colorScheme: scheme})
      const shot = (file: string) => page.screenshot({path: join(OUT, `${file}-${name}-${size}.png`)})

      await page.goto('/')
      for (const n of [1, 2, 3, 4, 5]) {
        await expect(page.getByTestId('welcome-step')).toHaveText(`Step ${n} of 5`)
        await page.waitForTimeout(450) // the slide-in settles
        await shot(`intro-${n}`)
        if (n < 5) await page.getByTestId('welcome-next').click()
      }
      await page.getByTestId('welcome-next').click()
      await expect(page.getByTestId('continue-form')).toBeVisible()
      await page.waitForTimeout(300)
      await shot('continue')

      await continueWith(page, 'dev@splito.test')
      await expect(page.getByTestId('credential-form')).toBeVisible()
      await page.waitForTimeout(450)
      await shot('credential-password')
      await page.getByTestId('method-code').click()
      await expect(page.getByTestId('dev-banner')).toBeVisible()
      await shot('credential-code')

      await page.goto('/')
      await expect(page.getByTestId('continue-form')).toBeVisible()
      await continueWith(page, 'new-shot@example.com')
      await expect(page.getByTestId('code-form')).toBeVisible()
      await page.getByTestId('code-input').fill(await devCode(page))
      await shot('verify')
      await page.getByTestId('code-next').click()
      await page.getByTestId('name-input').fill('Riya')
      await page.getByTestId('name-next').click()
      await page.getByTestId('other-input').fill('+91 98765 43210')
      await shot('other-contact')
      await page.getByTestId('other-next').click()
      await page.getByTestId('code-input').fill(await devCode(page))
      await page.getByTestId('code-next').click()
      await page.getByTestId('newPasswordInput').fill('abcdefg1')
      await shot('password-strength')
    })
  }
}

async function addMissing(page: Page) {
  await toContinue(page)
  await page.evaluate(() => (window as unknown as {__splitoTest: {seedAccount(a: object): void}}).__splitoTest.seedAccount({name: 'Old', email: 'old@example.com', password: 'oldpassword1'}))
  await continueWith(page, 'old@example.com')
  await page.getByTestId('credential-password').fill('oldpassword1')
  await page.getByTestId('credential-next').click()
  await expect(page.getByTestId('add-missing')).toBeVisible()
}

for (const [size, viewport] of Object.entries(SIZES)) {
  test(`add-missing step, ${size}`, async ({page}) => {
    await page.setViewportSize(viewport)
    await addMissing(page)
    await page.screenshot({path: join(OUT, `add-phone-light-${size}.png`)})
  })
}

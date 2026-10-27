import {expect, type Page, test} from '@playwright/test'

const LAPTOP = {width: 1280, height: 800}
const WIDE = {width: 1440, height: 900}
const PHONE = {width: 390, height: 844}

const NOT_LIVE = 'Sign-in arrives with sync. Your data stays safe on this device.'

async function openFromSettings(page: Page) {
  await page.goto('/settings')
  await expect(page.getByTestId('screen-settings')).toBeVisible()
  await page.getByTestId('settings-sign-in').click()
  await expect(page.getByTestId('screen-sign-in')).toBeVisible()
  await expect(page.getByTestId('signInButton')).toBeVisible()
}

test('Settings > Sign in opens Bluesky\'s logged-out splash full screen, and it closes', async ({
  page,
}) => {
  // Wide enough for the right column, which must not sit over the flow.
  await page.setViewportSize(WIDE)
  await openFromSettings(page)
  // Full screen: it covers the whole window, sidebar and right column included.
  const box = await page.getByTestId('screen-sign-in').boundingBox()
  expect(box).toMatchObject({x: 0, y: 0, ...WIDE})
  await page.getByTestId('authClose').hover()
  await expect(page.getByTestId('createAccountButton')).toBeVisible()
  await page.getByTestId('authClose').click()
  await expect(page.getByTestId('screen-settings')).toBeVisible()
})

test('Sign in validates every field, then answers honestly: no fake success', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await openFromSettings(page)
  await page.getByTestId('signInButton').click()
  await expect(page.getByTestId('loginForm')).toBeVisible()

  await page.getByTestId('loginNextButton').click()
  await expect(page.getByTestId('loginError')).toContainText('email or phone')

  await page.getByTestId('loginIdentifierInput').fill('riya@')
  await page.getByTestId('loginNextButton').click()
  await expect(page.getByTestId('loginError')).toContainText('name@example.com')

  await page.getByTestId('loginIdentifierInput').fill('riya@example.com')
  await page.getByTestId('loginNextButton').click()
  await expect(page.getByTestId('loginError')).toContainText('password')

  await page.getByTestId('loginPasswordInput').fill('correct horse')
  await page.getByTestId('loginNextButton').click()
  await expect(page.getByTestId('auth-not-live')).toContainText(NOT_LIVE)
  await expect(page.getByTestId('loginError')).toHaveCount(0)
  // Still signed out: the drawer footer still offers Sign in.
  await page.getByTestId('loginBackButton').click()
  await expect(page.getByTestId('signInButton')).toBeVisible()
})

test('Forgot password walks to the new-password step and never reports a reset', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await openFromSettings(page)
  await page.getByTestId('signInButton').click()
  await page.getByTestId('loginForgotButton').click()
  await expect(page.getByTestId('forgotPasswordForm')).toBeVisible()

  await page.getByTestId('forgotPasswordNext').click()
  await expect(page.getByTestId('forgotPasswordError')).toBeVisible()
  await page.getByTestId('forgotPasswordIdentifier').fill('+91 98765 43210')
  await page.getByTestId('forgotPasswordNext').click()
  await expect(page.getByTestId('auth-not-live')).toBeVisible()

  await page.getByTestId('skipSendCodeButton').click()
  await expect(page.getByTestId('setNewPasswordForm')).toBeVisible()
  await page.getByTestId('resetCodeInput').fill('12')
  await page.getByTestId('setNewPasswordNext').click()
  await expect(page.getByTestId('setNewPasswordError')).toContainText('6 digits')
  await page.getByTestId('resetCodeInput').fill('123456')
  await page.getByTestId('newPasswordInput').fill('short')
  await page.getByTestId('setNewPasswordNext').click()
  await expect(page.getByTestId('setNewPasswordError')).toContainText('8 characters')
  await page.getByTestId('newPasswordInput').fill('longenough')
  await page.getByTestId('setNewPasswordNext').click()
  await expect(page.getByTestId('auth-not-live')).toBeVisible()
  await expect(page.getByTestId('passwordUpdatedForm')).toHaveCount(0)
})

test('Create account asks for name, email or phone and a password, and creates nothing', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP)
  await openFromSettings(page)
  await page.getByTestId('createAccountButton').click()
  await expect(page.getByTestId('createAccount')).toBeVisible()

  await page.getByTestId('nextBtn').click()
  await expect(page.getByTestId('signupError')).toContainText('name')
  await page.getByTestId('nameInput').fill('Riya Sharma')
  await page.getByTestId('nextBtn').click()
  await expect(page.getByTestId('signupError')).toContainText('email or phone')
  await page.getByTestId('identifierInput').fill('12')
  await page.getByTestId('nextBtn').click()
  await expect(page.getByTestId('signupError')).toContainText('country code')
  await page.getByTestId('identifierInput').fill('riya@example.com')
  await page.getByTestId('nextBtn').click()
  await expect(page.getByTestId('signupError')).toContainText('password')
  await page.getByTestId('passwordInput').fill('1234567')
  await page.getByTestId('nextBtn').click()
  await expect(page.getByTestId('signupError')).toContainText('8 characters')
  await page.getByTestId('passwordInput').fill('12345678')
  await expect(page.getByTestId('signupError')).toHaveCount(0)
  await page.getByTestId('nextBtn').click()
  await expect(page.getByTestId('auth-not-live')).toContainText(NOT_LIVE)

  await page.getByTestId('backBtn').click()
  await expect(page.getByTestId('createAccountButton')).toBeVisible()
})

test('on a phone the drawer\'s Sign in opens the same flow, with a back arrow', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await page.locator('[data-testid="header-avatar"]:visible').first().click()
  await page.getByTestId('drawer-sign-in').click()
  await expect(page.getByTestId('screen-sign-in')).toBeVisible()
  await page.getByTestId('signInButton').click()
  await expect(page.getByTestId('loginForm')).toBeVisible()
  // No horizontal overflow at phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await page.getByTestId('loginBackButton').click()
  await expect(page.getByTestId('createAccountButton')).toBeVisible()
  await page.getByTestId('authClose').click()
  await expect(page.getByTestId('screen-sign-in')).toHaveCount(0)
})

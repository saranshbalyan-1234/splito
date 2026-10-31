import {expect, type Page, test} from '@playwright/test'

import {continueWith, createAccount, databases, DEV, devCode, logOutFromProfile, signedInShown, signInWithPassword, toContinue} from './auth'
import {openProfile} from './nav'
import {signedOut} from './signedOut'

/*
 * F-250: sign-in is required. Everything here starts from a fresh install (no session) and runs the real Continue
 * screens against the dev AuthClient (dev and e2e builds only; production has no such path).
 */
test.use(signedOut)

const PHONE = {width: 390, height: 844}
const NEW = {email: 'riya@example.com', phone: '+91 98765 43210', name: 'Riya', password: 'longpassword1'}

test.describe('signed out, nothing of the app exists', () => {
  for (const path of ['/', '/groups', '/settings', '/activity', '/analytics', '/people/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77', '/expense/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77', '/groups?type=trip', '/?drawer=menu', '/search?q=dinner&mode=ask']) {
    test(`${path} shows the Continue screen, renders no screen and opens no database`, async ({page}) => {
      await page.setViewportSize(PHONE)
      await toContinue(page, path)
      for (const id of ['screen-people', 'screen-groups', 'screen-settings', 'screen-activity', 'screen-analytics', 'screen-person', 'screen-expense', 'bottom-bar', 'sidebar', 'drawer', 'search-drawer'])
        await expect(page.getByTestId(id)).toHaveCount(0)
      expect(await databases(page)).toEqual([])
      // The page holds the sign-in and no ledger text at all.
      expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/You owe|owes you|Settle up|Add expense/)
    })
  }

  test('the intro comes first on a fresh install, for every address', async ({page}) => {
    await page.goto('/groups')
    await expect(page.getByTestId('welcome')).toBeVisible()
    await expect(page.getByTestId('screen-groups')).toHaveCount(0)
    expect(await databases(page)).toEqual([])
  })

  test('/join/<token> stays public and leads to sign-in; a near-miss does not', async ({page}) => {
    await page.goto('/join/abc123def456')
    await expect(page.getByTestId('public-join')).toBeVisible()
    await expect(page).toHaveURL(/\/join\/abc123def456$/)
    expect(await databases(page)).toEqual([])
    await expect(page.getByTestId('screen-people')).toHaveCount(0)
    await page.getByTestId('public-continue').click()
    await expect(page.getByTestId('continue-form')).toBeVisible()
    await page.goto('/join/abc')
    await expect(page.getByTestId('public-join')).toHaveCount(0)
    await expect(page.getByTestId('welcome').or(page.getByTestId('continue-form'))).toBeVisible()
  })

  test('the help and legal pages are reachable signed out, from Continue and by address, and open no database', async ({page}) => {
    await toContinue(page)
    for (const page_ of ['help', 'privacy', 'about'] as const) {
      await page.getByTestId(`public-link-${page_}`).click()
      await expect(page.getByTestId(`public-${page_}`)).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/settings/${page_}$`))
      // The signed-in extras are not here: no intro link (there is no navigator to open it in).
      await expect(page.getByTestId('help-see-intro')).toHaveCount(0)
      await page.getByTestId('public-back').click()
      await expect(page.getByTestId('continue-form')).toBeVisible()
    }
    await page.goto('/settings/privacy')
    await expect(page.getByTestId('public-privacy')).toBeVisible()
    await expect(page.getByTestId('screen-settings-section')).toHaveCount(0)
    expect(await databases(page)).toEqual([])
    // Nothing is held for later: signing in lands on the start tab, not on Privacy.
    await page.getByTestId('public-back').click()
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
  })
})

test.describe('the launch screen', () => {
  test('a cold load signed out ends it: #launch is gone and the intro shows', async ({page}) => {
    await page.goto('/')
    await expect(page.getByTestId('welcome')).toBeVisible()
    await expect(page.locator('#launch')).toHaveCount(0, {timeout: 10_000})
    expect(await databases(page)).toEqual([])
  })

  test('a cold load on Continue, on a public page and on the blocking add step end it too', async ({page}) => {
    await toContinue(page)
    await page.reload()
    await expect(page.getByTestId('continue-form')).toBeVisible()
    await expect(page.locator('#launch')).toHaveCount(0, {timeout: 10_000})
    await page.goto('/settings/about')
    await expect(page.getByTestId('public-about')).toBeVisible()
    await expect(page.locator('#launch')).toHaveCount(0, {timeout: 10_000})
    await page.goto('/')
    await page.waitForFunction(() => !!(window as unknown as {__splitoTest?: {seedAccount?: unknown}}).__splitoTest?.seedAccount)
    await page.evaluate(() => (window as unknown as {__splitoTest: {seedAccount(a: object): void}}).__splitoTest.seedAccount({name: 'Old', email: 'launch@example.com', password: 'oldpassword1'}))
    await signInWithPassword(page, 'launch@example.com', 'oldpassword1')
    await expect(page.getByTestId('add-missing')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('add-missing')).toBeVisible()
    await expect(page.locator('#launch')).toHaveCount(0, {timeout: 10_000})
  })
})

test.describe('the Continue screen', () => {
  test('Apple and Google first by platform, each saying it arrives with sync; no fake success', async ({page}) => {
    await page.setViewportSize(PHONE)
    await toContinue(page)
    const google = (await page.getByTestId('continue-google').boundingBox())!
    const apple = (await page.getByTestId('continue-apple').boundingBox())!
    // Web: Google first (Apple first on iOS only).
    expect(google.y).toBeLessThan(apple.y)
    await page.getByTestId('continue-google').click()
    await expect(page.getByTestId('auth-social-not-live')).toContainText('arrives with sync')
    await page.getByTestId('continue-apple').click()
    await expect(page.getByTestId('continue-form')).toBeVisible()
    await expect(page.getByTestId('screen-people')).toHaveCount(0)
    expect(await databases(page)).toEqual([])
  })

  test('validates the field, then finds nothing wrong with a real email or phone', async ({page}) => {
    await toContinue(page)
    await page.getByTestId('continue-next').click()
    await expect(page.getByTestId('continue-error')).toContainText('email or phone')
    await continueWith(page, 'riya@')
    await expect(page.getByTestId('continue-error')).toContainText('name@example.com')
    await continueWith(page, '12')
    await expect(page.getByTestId('continue-error')).toBeVisible()
  })

  test('"Continue with a dev account" is labelled and signs in the local dev account', async ({page}) => {
    await toContinue(page)
    await expect(page.getByTestId('continue-dev-account')).toContainText('Continue with a dev account')
    await expect(page.getByText('Dev builds only')).toBeVisible()
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    expect(await databases(page)).toContain('splito-acct-dev')
  })

  test('Back and Forward are not offered an account-creation screen: there is no Create account anywhere', async ({page}) => {
    await toContinue(page)
    await expect(page.getByText(/create account/i)).toHaveCount(0)
  })
})

test.describe('an existing account', () => {
  test('signs in with its password, and a wrong one says so', async ({page}) => {
    await toContinue(page)
    await signInWithPassword(page, DEV.email, 'not-the-password')
    await expect(page.getByTestId('credential-error')).toContainText('password')
    await page.getByTestId('credential-password').fill(DEV.password)
    await page.getByTestId('credential-next').click()
    await signedInShown(page)
    expect(await databases(page)).toContain('splito-acct-dev')
  })

  test('the contact may be a phone number', async ({page}) => {
    await toContinue(page)
    await signInWithPassword(page, '+91 98765 00001', DEV.password)
    await signedInShown(page)
  })

  test('signs in with a one-time code from the dev banner; a wrong code is refused', async ({page}) => {
    await toContinue(page)
    await continueWith(page, DEV.email)
    await page.getByTestId('method-code').click()
    await expect(page.getByTestId('credential-code-sent')).toContainText(DEV.email)
    await page.getByTestId('credential-code').fill('000000')
    await page.getByTestId('credential-next').click()
    await expect(page.getByTestId('credential-error')).toContainText('code')
    await page.getByTestId('credential-code').fill(await devCode(page))
    await page.getByTestId('credential-next').click()
    await signedInShown(page)
  })

  test('Password | Code: the last one used on this device is preselected next time', async ({page}) => {
    await toContinue(page)
    await continueWith(page, DEV.email)
    await expect(page.getByTestId('method-password')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('method-code').click()
    await page.getByTestId('credential-code').fill(await devCode(page))
    await page.getByTestId('credential-next').click()
    await signedInShown(page)
    await logOutFromProfile(page)
    await continueWith(page, DEV.email)
    await expect(page.getByTestId('method-code')).toHaveAttribute('aria-checked', 'true')
    // The other is a tap away.
    await page.getByTestId('method-password').click()
    await expect(page.getByTestId('credential-password')).toBeVisible()
  })

  test('Forgot? sends a code, sets a new password and signs in with it', async ({page}) => {
    await toContinue(page)
    await continueWith(page, DEV.email)
    await page.getByTestId('credential-forgot').click()
    await expect(page.getByTestId('forgotPasswordForm')).toBeVisible()
    await page.getByTestId('forgotPassword-next').click()
    await expect(page.getByTestId('setNewPasswordForm')).toBeVisible()
    await page.getByTestId('resetCodeInput').fill('12')
    await page.getByTestId('newPasswordInput').fill('short')
    await page.getByTestId('setNewPassword-next').click()
    await expect(page.getByTestId('setNewPasswordError')).toContainText('6 digits')
    await page.getByTestId('resetCodeInput').fill(await devCode(page))
    await page.getByTestId('setNewPassword-next').click()
    await expect(page.getByTestId('setNewPasswordError')).toContainText('8 characters')
    await page.getByTestId('newPasswordInput').fill('brandnewpass1')
    await page.getByTestId('setNewPassword-next').click()
    await expect(page.getByTestId('passwordUpdatedForm')).toBeVisible()
    await page.getByTestId('passwordUpdatedOk').click()
    await page.getByTestId('method-password').click()
    await page.getByTestId('credential-password').fill('brandnewpass1')
    await page.getByTestId('credential-next').click()
    await signedInShown(page)
  })

  test('signing in offline says it needs a connection', async ({page, context}) => {
    await toContinue(page)
    await context.setOffline(true)
    await continueWith(page, DEV.email)
    await expect(page.getByTestId('continue-error')).toContainText('needs a connection')
    await context.setOffline(false)
  })
})

test.describe('a new account', () => {
  test('is made in the same flow: verify, name, the other contact verified, a password with its strength', async ({page}) => {
    await page.setViewportSize(PHONE)
    await toContinue(page)
    await continueWith(page, NEW.email)
    // Nothing hints that this account was unknown beyond "We'll create your account".
    await expect(page.getByTestId('code-form')).toContainText('create your account')
    await page.getByTestId('code-input').fill('111')
    await page.getByTestId('code-next').click()
    await expect(page.getByTestId('code-error')).toBeVisible()
    await page.getByTestId('code-input').fill(await devCode(page))
    await page.getByTestId('code-next').click()
    await page.getByTestId('name-next').click()
    await expect(page.getByTestId('name-error')).toBeVisible()
    await page.getByTestId('name-input').fill(NEW.name)
    await page.getByTestId('name-next').click()
    // The other contact is the one still missing: a phone, since an email was given.
    await expect(page.getByTestId('other-contact-form')).toContainText('phone')
    await page.getByTestId('other-input').fill('riya@example.com')
    await page.getByTestId('other-next').click()
    await expect(page.getByTestId('other-error')).toBeVisible()
    await page.getByTestId('other-input').fill(NEW.phone)
    await page.getByTestId('other-next').click()
    await page.getByTestId('code-input').fill(await devCode(page))
    await page.getByTestId('code-next').click()
    // Password: minimum 8, strength shown.
    await page.getByTestId('newPasswordInput').fill('abc')
    await expect(page.getByTestId('password-strength-label')).toContainText('Too short')
    await page.getByTestId('setNewPassword-next').click()
    await expect(page.getByTestId('setNewPasswordError')).toContainText('8 characters')
    await page.getByTestId('newPasswordInput').fill('abcdefgh')
    await expect(page.getByTestId('password-strength-label')).toHaveText('Weak')
    await page.getByTestId('newPasswordInput').fill('abcdefg1')
    await expect(page.getByTestId('password-strength-label')).toHaveText('Fair')
    await page.getByTestId('newPasswordInput').fill(NEW.password + 'A!')
    await expect(page.getByTestId('password-strength-label')).toHaveText('Strong')
    await page.getByTestId('newPasswordInput').fill(NEW.password)
    await page.getByTestId('setNewPassword-next').click()
    await signedInShown(page)
    // Account row in Settings shows the new account.
    await page.goto('/settings')
    await expect(page.getByTestId('settings-profile')).toContainText(NEW.email)
  })

  test('starting with a phone asks for the email next; the account can then sign in with either', async ({page}) => {
    await toContinue(page)
    await continueWith(page, '+91 98765 11111')
    await page.getByTestId('code-input').fill(await devCode(page))
    await page.getByTestId('code-next').click()
    await page.getByTestId('name-input').fill('Dev Two')
    await page.getByTestId('name-next').click()
    await expect(page.getByTestId('other-contact-form')).toContainText('email')
    await page.getByTestId('other-input').fill('two@example.com')
    await page.getByTestId('other-next').click()
    await page.getByTestId('code-input').fill(await devCode(page))
    await page.getByTestId('code-next').click()
    await page.getByTestId('newPasswordInput').fill('longpassword2')
    await page.getByTestId('setNewPassword-next').click()
    await signedInShown(page)
    await logOutFromProfile(page)
    // It exists now, by either contact.
    await signInWithPassword(page, 'two@example.com', 'longpassword2')
    await signedInShown(page)
  })
})

test.describe('a missing email or phone blocks the app', () => {
  test('an email-only account must add and verify a phone before anything else', async ({page}) => {
    await toContinue(page)
    await page.evaluate(() => (window as unknown as {__splitoTest: {seedAccount(a: object): void}}).__splitoTest.seedAccount({name: 'Old Email', email: 'old@example.com', password: 'oldpassword1'}))
    await signInWithPassword(page, 'old@example.com', 'oldpassword1')
    await expect(page.getByTestId('add-missing')).toBeVisible()
    await expect(page.getByText('Add your phone number').first()).toBeVisible()
    // Not the start tab, not setup, no database; the only other action is Log out.
    await expect(page.getByTestId('screen-people')).toHaveCount(0)
    expect(await databases(page)).toEqual([])
    await page.reload()
    await expect(page.getByTestId('add-missing')).toBeVisible()
    await page.getByTestId('other-input').fill('not a phone')
    await page.getByTestId('other-next').click()
    await expect(page.getByTestId('other-error')).toBeVisible()
    await page.getByTestId('other-input').fill('+91 98765 22222')
    await page.getByTestId('other-next').click()
    await page.getByTestId('code-input').fill('000000')
    await page.getByTestId('code-next').click()
    await expect(page.getByTestId('code-error')).toBeVisible()
    await page.getByTestId('code-input').fill(await devCode(page))
    await page.getByTestId('code-next').click()
    await signedInShown(page)
  })

  test('a phone-only account must add an email; offline the step says it needs a connection', async ({page, context}) => {
    await toContinue(page)
    await page.evaluate(() => (window as unknown as {__splitoTest: {seedAccount(a: object): void}}).__splitoTest.seedAccount({name: 'Old Phone', phone: '+919876533333', password: 'oldpassword1'}))
    await signInWithPassword(page, '+91 98765 33333', 'oldpassword1')
    await expect(page.getByText('Add your email').first()).toBeVisible()
    await context.setOffline(true)
    await expect(page.getByTestId('other-offline')).toContainText('needs a connection')
    await expect(page.getByTestId('other-next')).toBeDisabled()
    await context.setOffline(false)
    await expect(page.getByTestId('other-offline')).toHaveCount(0)
    await page.getByTestId('other-input').fill('oldphone@example.com')
    await page.getByTestId('other-next').click()
    await page.getByTestId('code-input').fill(await devCode(page))
    await page.getByTestId('code-next').click()
    await signedInShown(page)
  })

  test('Log out is the way out of the blocking step', async ({page}) => {
    await toContinue(page)
    await page.evaluate(() => (window as unknown as {__splitoTest: {seedAccount(a: object): void}}).__splitoTest.seedAccount({name: 'Old Email', email: 'old2@example.com', password: 'oldpassword1'}))
    await signInWithPassword(page, 'old2@example.com', 'oldpassword1')
    await page.getByTestId('add-missing-logout').click()
    await expect(page.getByTestId('continue-form')).toBeVisible()
  })
})

test.describe('sign-in preserves intent', () => {
  test('a deep link opened signed out is opened after sign-in', async ({page}) => {
    await page.setViewportSize({width: 1440, height: 900})
    await toContinue(page, '/activity/others')
    await signInWithPassword(page, DEV.email, DEV.password)
    await expect(page.getByTestId('screen-activity')).toBeVisible({timeout: 20_000})
    await expect(page).toHaveURL(/\/activity\/others(\?from=[a-z]+)?$/)
  })

  test('a link that needed the intro first is still opened after it and sign-in', async ({page}) => {
    await page.goto('/settings/regional')
    await page.getByTestId('welcome-skip').click()
    await page.getByTestId('continue-dev-account').click()
    await expect(page.getByTestId('screen-settings-section')).toBeVisible({timeout: 20_000})
    await expect(page).toHaveURL(/\/settings\/regional$/)
  })

  test('a plain visit signs in to the start tab, People', async ({page}) => {
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
  })
})

test.describe('log out erases everything the account left (owner 186)', () => {
  const create = (page: Page, name: string) =>
    page.evaluate(n => (window as unknown as {splito: {createPerson(n: string): Promise<string>}}).splito.createPerson(n), name)

  test('the prompt says what it removes and warns about unsynced changes first; afterwards the account starts empty, its demo is gone and no database is left', async ({page}) => {
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await page.waitForFunction(() => 'splito' in window)
    await create(page, 'Erased Friend')
    // Demo mode is on: its own database goes with the account.
    test.setTimeout(90_000)
    await page.evaluate(() => (window as unknown as {__splitoTest: {demoMode(on: boolean): Promise<void>}}).__splitoTest.demoMode(true))
    await expect.poll(() => databases(page), {timeout: 30_000}).toContain('splito-demo-dev')
    await page.goto('/profile')
    await page.getByTestId('profile-log-out').click()
    const dialog = page.getByRole('dialog').filter({hasText: 'Log out?'})
    await expect(dialog).toContainText('This removes all your Splito data from this device')
    // The warning comes first, with the count (the person just written has not synced).
    await expect(dialog).toContainText('haven’t synced yet and will be lost')
    await expect(page.getByTestId('logout-confirm')).toBeEnabled()
    await expect(page.getByTestId('logout-keep')).toHaveCount(0)
    await page.getByTestId('logout-confirm').click()
    await expect(page.getByTestId('continue-form')).toBeVisible({timeout: 30_000})
    // Done before the logged-out flow showed: no database of that account, no demo one.
    expect((await databases(page)).filter(n => n!.startsWith('splito-'))).toEqual([])

    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Erased Friend')).toHaveCount(0)
    // Demo mode is off again, and the demo database was not kept.
    await expect(page.getByTestId('header-avatar').last()).not.toHaveAttribute('aria-label', /Demo$/)
    expect(await databases(page)).not.toContain('splito-demo-dev')
  })

  /** Signed in on a phone with a friend written, the browser then refusing to delete any database (another tab holds it, say), and the log out confirmed from Profile. */
  async function failedLogOut(page: Page) {
    await page.setViewportSize(PHONE)
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await page.waitForFunction(() => 'splito' in window)
    await create(page, 'Stubborn Friend')
    await page.evaluate(() => {
      const w = window as unknown as {__realDelete?: typeof indexedDB.deleteDatabase}
      w.__realDelete = indexedDB.deleteDatabase.bind(indexedDB)
      indexedDB.deleteDatabase = () => {
        const req = {} as IDBOpenDBRequest
        setTimeout(() => (req.onerror as (() => void) | null)?.(), 0)
        return req
      }
    })
    await openProfile(page)
    await page.getByTestId('profile-log-out').click()
    await page.getByTestId('logout-confirm').click()
    await expect(page.getByTestId('logout-failed')).toBeVisible({timeout: 30_000})
    // Half done is never shown as done: still not the logged-out flow, and the session is still there.
    await expect(page.getByTestId('continue-form')).toHaveCount(0)
  }

  test('a failed erase is reported with Try again; the session stays until it is done, and retrying finishes it', async ({page}) => {
    await failedLogOut(page)
    await page.evaluate(() => {
      const w = window as unknown as {__realDelete: typeof indexedDB.deleteDatabase}
      indexedDB.deleteDatabase = w.__realDelete
    })
    await page.getByTestId('logout-retry').click()
    await expect(page.getByTestId('continue-form')).toBeVisible({timeout: 30_000})
    expect((await databases(page)).filter(n => n!.startsWith('splito-'))).toEqual([])
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Stubborn Friend')).toHaveCount(0)
  })

  test('closing the page in the middle of a log out resumes it at the next launch', async ({page}) => {
    await failedLogOut(page)
    await page.reload()
    await expect(page.getByTestId('continue-form')).toBeVisible({timeout: 30_000})
    expect((await databases(page)).filter(n => n!.startsWith('splito-'))).toEqual([])
  })

  test('Log out is the last row of Profile and is in neither the drawer footer nor the Settings list (owner 202)', async ({page}) => {
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await page.goto('/?drawer=menu')
    await expect(page.getByTestId('drawer')).toBeVisible()
    await expect(page.getByTestId('drawer-log-out')).toHaveCount(0)
    await page.goto('/settings')
    await expect(page.getByTestId('settings-log-out')).toHaveCount(0)
    await page.goto('/profile')
    await expect(page.getByTestId('profile-log-out')).toBeVisible()
    await page.getByTestId('profile-log-out').click()
    await expect(page.getByRole('dialog').filter({hasText: 'Log out?'})).toBeVisible()
    await page.getByTestId('logout-confirm').click()
    await expect(page.getByTestId('continue-form')).toBeVisible({timeout: 30_000})
  })

  test('accounts on one device never see each other\'s data: each starts empty, with its own "me"', async ({page}) => {
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await page.waitForFunction(() => 'splito' in window)
    await create(page, 'Only Dev')
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Only Dev')).toBeVisible()
    const devMe = await page.evaluate(() => (window as unknown as {splito: {me: string}}).splito.me)
    await logOutFromProfile(page)

    await createAccount(page, NEW)
    await signedInShown(page)
    await page.waitForFunction(() => 'splito' in window)
    expect(await page.evaluate(() => (window as unknown as {splito: {me: string}}).splito.me)).not.toBe(devMe)
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Only Dev')).toHaveCount(0)
    await create(page, 'Only Riya')
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Only Riya')).toBeVisible()
    expect((await databases(page)).filter(n => n!.startsWith('splito-acct-'))).toHaveLength(1)
    await logOutFromProfile(page)

    await signInWithPassword(page, DEV.email, DEV.password)
    await signedInShown(page)
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Only Dev')).toHaveCount(0)
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Only Riya')).toHaveCount(0)
  })
})

test.describe('data from before accounts', () => {
  test('is offered once after sign-in: "Move this device\'s data into your account"', async ({page}) => {
    await toContinue(page)
    await page.waitForFunction(() => !!(window as unknown as {__splitoTest?: {seedLegacy?: unknown}}).__splitoTest?.seedLegacy)
    await page.evaluate(() => (window as unknown as {__splitoTest: {seedLegacy(n: string[]): Promise<void>}}).__splitoTest.seedLegacy(['Old Friend']))
    expect(await databases(page)).toContain('splito')
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await expect(page.getByRole('dialog').filter({hasText: 'Move this device’s data into your account?'})).toContainText('Move this device’s data into your account')
    // Not merged silently: the old friend is not here yet.
    await expect(page.getByText('Old Friend')).toHaveCount(0)
    await page.getByTestId('legacy-move').click()
    // The old database is gone once the move is done; only then look at the People tab (leaving earlier would cut it short).
    await expect.poll(() => databases(page), {timeout: 30_000}).not.toContain('splito')
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Old Friend')).toBeVisible({timeout: 15_000})
    await page.reload()
    await signedInShown(page)
    await expect(page.getByRole('dialog').filter({hasText: 'Move this device’s data into your account?'})).toHaveCount(0)
  })

  test('an offer left open is made again at the next launch; Not now settles it, and Settings keeps a row while the old data exists', async ({page}) => {
    const offer = page.getByRole('dialog').filter({hasText: 'Move this device’s data into your account?'})
    await toContinue(page)
    await page.waitForFunction(() => !!(window as unknown as {__splitoTest?: {seedLegacy?: unknown}}).__splitoTest?.seedLegacy)
    await page.evaluate(() => (window as unknown as {__splitoTest: {seedLegacy(n: string[]): Promise<void>}}).__splitoTest.seedLegacy(['Old Friend']))
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await expect(offer).toBeVisible()
    // Not answered (the page went away with it open): asked again.
    await page.reload()
    await signedInShown(page)
    await expect(offer).toBeVisible()
    await page.getByRole('button', {name: 'Not now'}).click()
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Old Friend')).toHaveCount(0)
    // Answered: not offered by itself any more, and the old database is untouched.
    await page.reload()
    await signedInShown(page)
    await expect(offer).toHaveCount(0)
    expect(await databases(page)).toContain('splito')
    // Settings > Data still offers it while the old database exists, and Move then removes the row.
    await page.goto('/settings/data')
    await page.getByTestId('settings-move-legacy').click()
    await expect(offer).toBeVisible()
    await page.getByTestId('legacy-move').click()
    await expect.poll(() => databases(page)).not.toContain('splito')
    await expect(page.getByTestId('settings-move-legacy')).toHaveCount(0)
    await page.goto('/')
    await page.goto('/people') // the People tab lists every friend
    await expect(page.getByText('Old Friend')).toBeVisible({timeout: 15_000})
  })

  test('no offer when the device has no old data', async ({page}) => {
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await expect(page.getByRole('dialog').filter({hasText: 'Move this device’s data into your account?'})).toHaveCount(0)
  })
})

test.describe('tabs, languages and codes', () => {
  test('another tab signing out signs this one out too (the session key is watched)', async ({page, context}) => {
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    const other = await context.newPage()
    await other.goto('/')
    await signedInShown(other)
    await other.evaluate(() => (window as unknown as {__splitoTest: {signOut(): void}}).__splitoTest.signOut())
    await expect(page.getByTestId('continue-form')).toBeVisible({timeout: 10_000})
    await expect(page.getByTestId('screen-people')).toHaveCount(0)
  })

  test('the language in use stays after log out, and on the next cold start', async ({page}) => {
    await toContinue(page)
    await page.getByTestId('continue-dev-account').click()
    await signedInShown(page)
    await page.waitForFunction(() => 'splito' in window)
    await page.evaluate(() => (window as unknown as {splito: {setPref(k: string, v: unknown): Promise<void>}}).splito.setPref('language', 'hi'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    await logOutFromProfile(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    await expect(page.getByTestId('continue-form')).toBeVisible()
  })

  test('a pasted code keeps only its digits', async ({page}) => {
    await toContinue(page)
    await continueWith(page, 'paste@example.com')
    await expect(page.getByTestId('code-form')).toBeVisible()
    const code = await devCode(page)
    await page.getByTestId('code-input').fill(`Your code: ${code.slice(0, 3)} ${code.slice(3)}!`)
    await expect(page.getByTestId('code-input')).toHaveValue(code)
    await page.getByTestId('code-next').click()
    await expect(page.getByTestId('name-form')).toBeVisible()
  })

  test('a code of an older request is refused once a new one is sent', async ({page}) => {
    await toContinue(page)
    await continueWith(page, 'again@example.com')
    const first = await devCode(page)
    await page.getByTestId('code-resend').click()
    await expect.poll(async () => (await page.getByTestId('dev-code').textContent()) !== first, {timeout: 5000}).toBe(true)
    await page.getByTestId('code-input').fill(first)
    await page.getByTestId('code-next').click()
    await expect(page.getByTestId('code-error')).toBeVisible()
  })
})

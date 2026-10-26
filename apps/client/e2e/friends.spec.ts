import {expect, type Page, test} from '@playwright/test'

/*
 * 26.18: adding friends by email or number, consent, invites and invite
 * links. Demo mode (?demo=1) has the fake directory: ananya@example.com is
 * on Splito, anything else is not. Without demo the directory is unavailable,
 * as production is until the backend exists.
 */

const DESKTOP = {width: 1440, height: 900}
const PHONE = {width: 390, height: 844}

type Splito = {acceptOutgoing(contactValue: string, name: string): Promise<string>}

async function openDemo(page: Page) {
  await page.setViewportSize(DESKTOP)
  await page.goto('/?demo=1')
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
}

async function openAddFriend(page: Page) {
  await page.getByTestId('people-add-friend').click()
  await expect(page.getByTestId('screen-add-friend')).toBeVisible()
}

async function pickerOptions(page: Page) {
  await page.getByTestId('sidebar-add').click()
  await expect(page.getByTestId('screen-add-expense')).toBeVisible()
  await page.getByTestId('expense-people').click()
  return page.getByTestId('people-dialog')
}

test('on Splito: request -> pending (not selectable) -> they accept -> a friend everywhere', async ({page}) => {
  await openDemo(page)
  await openAddFriend(page)
  await page.getByTestId('add-friend-contact').fill('Ananya@Example.com')
  await expect(page.getByTestId('add-friend-status-on-splito')).toContainText('ananya@example.com is on Splito')
  const save = page.getByTestId('sheet-save')
  await expect(save).toHaveText('Send friend request')
  await save.click()
  await expect(page.getByTestId('screen-add-friend')).toHaveCount(0)
  await expect(page.getByText('Friend request sent to ananya@example.com')).toBeVisible()

  // Waiting under Invites sent.
  const row = page.getByTestId('invite-sent-ananya@example.com')
  await expect(row).toContainText('Waiting to accept')

  // Not selectable while pending: greyed, no checkbox.
  const dialog = await pickerOptions(page)
  await expect(dialog.getByTestId('pending-ananya@example.com')).toContainText('Waiting for ananya@example.com to accept')
  await expect(dialog.getByTestId('person-option-ananya@example.com')).toHaveCount(0)
  await dialog.getByTestId('sheet-close').click()
  await page.getByTestId('screen-add-expense').getByTestId('sheet-close').click()

  // They accept (stands in for the pull from their device).
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.acceptOutgoing('ananya@example.com', 'Ananya Gupta'))
  await expect(page.getByTestId('person-Ananya Gupta')).toBeVisible()
  await expect(row).toHaveCount(0)
  const after = await pickerOptions(page)
  await expect(after.getByTestId('person-option-Ananya Gupta')).toBeVisible()
  await expect(after.getByTestId('pending-ananya@example.com')).toHaveCount(0)
})

test('incoming requests: People > Requests and Activity, Accept makes a friend', async ({page}) => {
  await openDemo(page)
  await expect(page.getByTestId('people-requests-title')).toHaveText('Requests  2')
  await page.getByTestId('tab-activity').click()
  const activityRow = page.getByTestId('activity-friendRequest.received').filter({hasText: 'Sara Ali'})
  await expect(activityRow).toContainText('sent you a friend request')
  await expect(activityRow.getByTestId('activity-unread-dot')).toBeVisible()
  await page.getByTestId('tab-people').click()
  await page.getByTestId('request-Ishaan Verma').getByTestId('request-accept').click()
  await expect(page.getByTestId('person-name')).toHaveText('Ishaan Verma')
})

test('not on Splito: warning, then Add anyway (only for you) is selectable at once', async ({page}) => {
  await openDemo(page)
  await openAddFriend(page)
  await page.getByTestId('add-friend-contact').fill('+44 7911 123456')
  await page.getByTestId('add-friend-name').fill('Zoe Hart')
  const warning = page.getByTestId('add-friend-status-not-on-splito')
  await expect(warning).toContainText('+44 7911 123456 isn’t on Splito yet')
  await expect(page.getByTestId('sheet-save')).toHaveText('Send invite')
  await page.getByTestId('add-friend-add-anyway').click()
  await expect(page.getByTestId('person-name')).toHaveText('Zoe Hart')
  // Composing from their page brings them in: a private friend is usable at once.
  const dialog = await pickerOptions(page)
  await expect(dialog.getByRole('checkbox', {name: 'Zoe Hart'})).toBeChecked()
  await expect(dialog.getByRole('checkbox', {name: 'Zoe Hart'})).toBeEnabled()
})

test('not on Splito: Send invite makes a personal one-use link and lists them under Invites sent', async ({page}) => {
  await openDemo(page)
  await openAddFriend(page)
  await page.getByTestId('add-friend-contact').fill('new.person@example.com')
  await expect(page.getByTestId('add-friend-status-not-on-splito')).toBeVisible()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('add-friend-invited')).toBeVisible()
  await expect(page.getByTestId('invite-url')).toHaveText(/^https:\/\/splito\.app\/invite\/[a-z0-9]{16}$/)
  await expect(page.getByTestId('invite-email')).toBeVisible()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('invite-sent-new.person@example.com')).toContainText('Invited, not on Splito yet')
})

test('offline (no directory): we’ll check when online, the request queues, Add anyway stays', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/friends/new')
  await page.getByTestId('add-friend-contact').fill('someone@example.com')
  await expect(page.getByTestId('add-friend-status-unavailable')).toContainText('We’ll check when you’re online')
  await expect(page.getByTestId('add-friend-add-anyway')).toBeVisible()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByText('Saved. We’ll check and send it when you’re online.')).toBeVisible()
  await expect(page.getByTestId('invite-sent-someone@example.com')).toContainText('We’ll send it when you’re online')
  // Invite links fail closed without the server: no made-up link.
  await page.goto('/invites/new')
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await expect(page.getByText('Invite links need a connection')).toBeVisible()
})

test('a bad value says what is wrong after leaving the field', async ({page}) => {
  await openDemo(page)
  await openAddFriend(page)
  await page.getByTestId('add-friend-contact').fill('riya@')
  await page.getByTestId('add-friend-name').click()
  await expect(page.getByTestId('add-friend-reason')).toHaveText('Enter a full email address, like name@example.com.')
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
})

test('invite link: limits, QR and link, then Manage invite links and Revoke', async ({page}) => {
  await openDemo(page)
  await page.getByTestId('people-more').click()
  await page.getByTestId('people-menu-invite-link').click()
  await expect(page.getByTestId('screen-create-invite')).toBeVisible()
  await page.getByTestId('invite-uses-5').click()
  await page.getByTestId('invite-expiry-24h').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('invite-qr')).toBeVisible()
  await expect(page.getByTestId('invite-details')).toHaveText('5 of 5 uses left · Expires in 1 day')
  const url = await page.getByTestId('invite-url').textContent()
  const code = url!.split('/').pop()!

  await page.getByTestId('sheet-cancel').click() // "Manage links"
  await expect(page.getByTestId('screen-invite-links')).toBeVisible()
  const row = page.getByTestId(`invite-link-${code}`)
  await expect(row.getByTestId('invite-link-details')).toHaveText('5 of 5 uses left · Expires in 1 day')
  // The seeded group link shows its uses and approval.
  await expect(page.getByText('22 of 25 uses left · Expires in 26 days · You approve each join')).toBeVisible()
  await row.getByTestId('invite-link-revoke').click()
  await expect(page.getByText('Revoke this invite link?')).toBeVisible()
  await page.getByTestId('confirmBtn').click()
  await expect(row).toHaveCount(0)
  await expect(page.getByTestId('invite-links-inactive')).toContainText('isn’t shown')

  // Opening your own revoked link says it no longer works.
  await page.goto(`/invite/${code}`)
  await expect(page.getByTestId('invite-own')).toContainText('Revoked')
})

test('group invite: approve each join, from the group overflow', async ({page}) => {
  await openDemo(page)
  await page.getByTestId('tab-groups').click()
  await page.getByTestId('screen-groups').getByTestId('group-Goa trip').click()
  await page.getByTestId('group-more').click()
  await page.getByTestId('group-menu-invite-link').click()
  await expect(page.getByText('Invite to Goa trip')).toBeVisible()
  await expect(page.getByTestId('invite-uses-25')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('invite-approve-joins').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('invite-details')).toHaveText('25 of 25 uses left · Expires in 7 days')
})

test('opening someone’s invite link: who invited you, then Accept', async ({page}) => {
  await openDemo(page)
  await page.goto('/invite/ananya2026demo')
  const card = page.getByTestId('invite-preview')
  await expect(card).toContainText('Ananya Gupta')
  await expect(card).toContainText('invited you to be friends on Splito')
  await card.getByTestId('invite-accept').click()
  await expect(page.getByTestId('person-name')).toHaveText('Ananya Gupta')
  await page.goto('/invite/nope0000')
  await expect(page.getByTestId('invite-broken')).toBeVisible()
})

test('contacts on web (Contact Picker API): a contact with two values asks which one', async ({page}) => {
  await page.addInitScript(() => {
    ;(navigator as unknown as {contacts: unknown}).contacts = {
      select: async () => [{name: ['Maya Chen'], tel: ['+1 415 555 0199'], email: ['maya@example.com']}],
    }
  })
  await openDemo(page)
  await openAddFriend(page)
  await page.getByTestId('add-friend-contacts').click()
  await expect(page.getByTestId('add-friend-pick-value')).toContainText('Which one should Splito use?')
  await page.getByTestId('contact-value-1').click()
  await expect(page.getByTestId('add-friend-contact')).toHaveValue('maya@example.com')
  await expect(page.getByTestId('add-friend-name')).toHaveValue('Maya Chen')
  await expect(page.getByTestId('add-friend-status-on-splito')).toBeVisible()
})

test('without the Contact Picker API the contacts button is hidden', async ({page}) => {
  await openDemo(page)
  await openAddFriend(page)
  await expect(page.getByTestId('add-friend-contact')).toBeVisible()
  await expect(page.getByTestId('add-friend-contacts')).toHaveCount(0)
})

test('phone: Add friend is a bottom sheet, full width from the bottom edge', async ({page}) => {
  await page.setViewportSize(PHONE)
  await page.goto('/?demo=1')
  await page.getByTestId('people-add-friend').click()
  const sheet = page.getByTestId('screen-add-friend')
  await expect(sheet).toBeVisible()
  await page.waitForTimeout(500)
  const box = (await sheet.boundingBox())!
  expect(box.width).toBe(PHONE.width)
  expect(Math.round(box.y + box.height)).toBe(PHONE.height)
  expect(box.y).toBeGreaterThanOrEqual(40)
  // The cross is at the top right; Cancel and the primary share the bottom.
  const close = (await page.getByTestId('sheet-close').boundingBox())!
  expect(close.x + close.width).toBeGreaterThan(PHONE.width - 40)
  const primary = (await page.getByTestId('sheet-save').boundingBox())!
  expect(primary.y + primary.height).toBeGreaterThan(PHONE.height - 80)
})

test('Settings > Privacy has the directory and invite-link choices', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/settings')
  await expect(page.getByTestId('settings-privacy-value')).toHaveText('Findable')
  await page.getByTestId('settings-privacy').click()
  await expect(page.getByTestId('pref-findableByEmailPhone')).toBeVisible()
  await expect(page.getByTestId('pref-friendRequestsFrom')).toBeVisible()
  await page.getByTestId('inviteMaxUses.friend-5').click()
  await expect(page.getByTestId('inviteMaxUses.friend-5')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('pref-inviteExpiry')).toBeVisible()
  await expect(page.getByTestId('settings-invite-links')).toBeVisible()
})

import {expect, type Page, test} from '@playwright/test'

import {openDemo as enterDemo} from './openDemo'

/*
 * 26.18: adding friends by email or number, consent, invites and invite
 * links. Demo mode has the fake directory: ananya@example.com is
 * on Splito, anything else is not. Without demo the directory is unavailable,
 * as production is until the backend exists.
 */

const DESKTOP = {width: 1440, height: 900}
const PHONE = {width: 390, height: 844}

type Splito = {acceptOutgoing(contactValue: string, name: string): Promise<string>}

async function openDemo(page: Page, path = '/people') {
  await page.setViewportSize(DESKTOP)
  await enterDemo(page, path)
  await expect(page.getByTestId('person-Riya Sharma')).toBeVisible()
}

async function openAddFriend(page: Page) {
  await page.getByTestId('people-add-friend').click()
  await expect(page.getByTestId('screen-add-friend')).toBeVisible()
}

/** Sent invites are rows on Home and People too (owner 175, at most 5); the full list is Activity's Friends and invites type (owner 195). Returns the row. */
async function openInvitesSent(page: Page, who: string) {
  await page.goto('/activity/all?type=friends')
  await expect(page.getByTestId('screen-activity').last().getByTestId('activity-list')).toBeVisible()
  const row = page.getByTestId('activity-friendRequest.sent').filter({hasText: who})
  await row.scrollIntoViewIfNeeded()
  return row
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

  // Waiting under Invites sent. Home shows 5 rows at most (2 requests and 3 invites already), so this sixth adds "See all".
  await expect(page.getByTestId('screen-people').getByTestId('people-requests-all')).toBeVisible()
  const row = await openInvitesSent(page, 'ananya@example.com')
  await expect(row).toContainText('ananya@example.com')
  await expect(row.getByTestId('invite-sent-resend')).toBeVisible()
  await expect(row.getByTestId('invite-sent-cancel')).toBeVisible()
  await page.goBack()

  // Not selectable while pending: greyed, no checkbox.
  const dialog = await pickerOptions(page)
  await expect(dialog.getByTestId('pending-ananya@example.com')).toContainText('Waiting for ananya@example.com to accept')
  await expect(dialog.getByTestId('person-option-ananya@example.com')).toHaveCount(0)
  await dialog.getByTestId('sheet-close').click()
  await page.getByTestId('screen-add-expense').getByTestId('sheet-close').click()

  // They accept (stands in for the pull from their device).
  await page.evaluate(() => (window as unknown as {splito: Splito}).splito.acceptOutgoing('ananya@example.com', 'Ananya Gupta'))
  await expect(page.getByTestId('person-Ananya Gupta')).toBeVisible()
  // The row names the friend now.
  const answered = await openInvitesSent(page, 'Ananya Gupta')
  await expect(answered.getByTestId('invite-sent-resend')).toHaveCount(0)
  await page.goBack()
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
  await page.getByTestId('screen-people').last().getByTestId('request-Ishaan Verma').getByTestId('request-accept').click()
  await expect(page.getByTestId('person-name')).toHaveText(/^Ishaan Verma( - Demo)?$/)
})

test('the demo set carries the invites flow: requests, invites sent, a joined friend, links and Activity rows', async ({page}) => {
  await openDemo(page)
  // Requests: two waiting (the one I declined is gone); invites sent: only the ones still waiting.
  await expect(page.getByTestId('people-requests-title')).toHaveText('Requests  2')
  // Home shows the invites sent as rows (owner 175); Activity's Friends and invites type holds the full list with Resend / Cancel in place (owner 195).
  for (const name of ['Kabir', 'Neha Joshi', 'Aarav Mehta']) await expect(page.getByTestId('screen-people').getByTestId(`invite-sent-${name}`)).toBeVisible()
  for (const name of ['Kabir', 'Neha Joshi', 'Aarav Mehta']) await expect((await openInvitesSent(page, name)).getByTestId('invite-sent-resend')).toBeVisible()
  for (const gone of ['Meera Nair', 'Zoya Khan']) await expect(page.getByTestId('activity-friendRequest.sent').filter({hasText: gone}).getByTestId('invite-sent-resend')).toHaveCount(0)
  await page.goBack()
  // Joined: the private "Tanvi Rao" was linked to the account when they accepted.
  await expect(page.getByTestId('person-Tanvi Rao')).toBeVisible()
  // Links: the active ones are listed, the rest counted.
  await page.goto('/invites')
  await expect(page.getByTestId('screen-invite-links')).toBeVisible()
  await expect(page.getByText('22 of 25 uses left · Expires in 26 days · You approve each join')).toBeVisible()
  // Activity: received, sent and the accepted invite.
  await page.goto('/activity')
  await expect(page.getByTestId('activity-friendRequest.received').filter({hasText: 'Ishaan Verma'})).toBeVisible()
  await expect(page.getByTestId('activity-friendRequest.sent').filter({hasText: 'Aarav Mehta'})).toBeVisible()
  await expect(page.getByTestId('activity-friendRequest.accepted').filter({hasText: 'Tanvi Rao'})).toBeVisible()
})

/*
 * 26.18 decision 76: request and invite rows are one horizontal line, the
 * actions side by side on the right, centred on the name block; icon-only
 * round buttons on phones (tooltip on long-press / hover), icon + text from
 * rail up. At 320 px the name truncates and the buttons never wrap.
 */
const ROWS: [string, string, [string, string][]][] = [
  ['request-Ishaan Verma', 'Ishaan Verma', [['request-accept', 'Accept'], ['request-decline', 'Decline']]],
  ['invite-sent-Kabir', 'Kabir', [['invite-sent-resend', 'Resend'], ['invite-sent-cancel', 'Cancel']]],
]
for (const viewport of [{width: 320, height: 800}, {width: 393, height: 852}, DESKTOP]) {
  test(`request and invite rows are one horizontal line at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport)
    await enterDemo(page)
    const isPhone = viewport.width < 800
    for (const [rowID, name, actions] of ROWS) {
      // Requests and the invites sent are both rows on Home (owner 175).
      const row = page.getByTestId(rowID)
      await row.scrollIntoViewIfNeeded()
      const r = (await row.boundingBox())!
      const n = (await row.getByText(name, {exact: true}).boundingBox())!
      // One line: avatar plus a two-line name block, no wrapped button row.
      expect(r.height).toBeLessThan(72)
      expect(r.x + r.width).toBeLessThanOrEqual(viewport.width)
      const boxes = []
      for (const [id, text] of actions) {
        const button = row.getByTestId(id)
        const b = (await button.boundingBox())!
        expect(b.y).toBeGreaterThanOrEqual(r.y)
        expect(b.y + b.height).toBeLessThanOrEqual(r.y + r.height)
        expect(b.x).toBeGreaterThanOrEqual(n.x + n.width)
        if (isPhone) {
          await expect(button).toHaveText('')
          expect(Math.abs(b.width - b.height)).toBeLessThan(1) // round
        } else {
          await expect(button).toHaveText(text)
        }
        boxes.push(b)
      }
      // Side by side on one y, centred with the name block.
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1)
      expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width)
      expect(Math.abs(boxes[0].y + boxes[0].height / 2 - (r.y + r.height / 2))).toBeLessThan(2)
    }
    if (isPhone) {
      // The icon-only button names itself on hover (and long-press on touch); the request is on Home.
      const accept = page.getByTestId('screen-home').getByTestId('request-Ishaan Verma').getByTestId('request-accept')
      await expect(accept).toHaveAttribute('aria-label', 'Accept Ishaan Verma’s friend request')
      await accept.hover()
      await expect(page.getByTestId('screen-home').getByTestId('request-accept-tooltip')).toHaveText('Accept')
    }
  })
}

test('not on Splito: warning, then Add anyway (only for you) is selectable at once', async ({page}) => {
  await openDemo(page)
  await openAddFriend(page)
  await page.getByTestId('add-friend-contact').fill('+44 7911 123456')
  await page.getByTestId('add-friend-name').fill('Zoe Hart')
  const warning = page.getByTestId('add-friend-status-not-on-splito')
  await expect(warning).toContainText('+44 7911 123456 isn’t on Splito yet')
  await expect(page.getByTestId('sheet-save')).toHaveText('Send invite')
  await page.getByTestId('add-friend-add-anyway').click()
  await expect(page.getByTestId('person-name')).toHaveText(/^Zoe Hart( - Demo)?$/)
  // Composing from their page brings them in: a private friend is usable at once.
  const dialog = await pickerOptions(page)
  await expect(dialog.getByRole('checkbox', {name: 'Zoe Hart'})).toBeChecked()
  await expect(dialog.getByRole('checkbox', {name: 'Zoe Hart'})).toBeEnabled()
})

test('a friend typed in lower case is saved and shown capitalised word by word (decision 181)', async ({page}) => {
  await openDemo(page)
  await openAddFriend(page)
  await page.getByTestId('add-friend-contact').fill('+44 7911 123457')
  await page.getByTestId('add-friend-name').fill('saransh   balyan')
  await page.getByTestId('add-friend-add-anyway').click()
  await expect(page.getByTestId('person-name')).toHaveText(/^Saransh Balyan( - Demo)?$/)
  await page.goBack()
  await expect(page.getByTestId('person-Saransh Balyan')).toBeVisible()
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
  const row = await openInvitesSent(page, 'new.person@example.com')
  await expect(row).toContainText('invited new.person@example.com to Splito')
})

test('offline (no directory): we’ll check when online, the request queues, Add anyway stays', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/friends/new')
  await page.getByTestId('add-friend-contact').fill('someone@example.com')
  await expect(page.getByTestId('add-friend-status-unavailable')).toContainText('We’ll check when you’re online')
  await expect(page.getByTestId('add-friend-add-anyway')).toBeVisible()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByText('Saved. We’ll check and send it when you’re online.')).toBeVisible()
  const row = await openInvitesSent(page, 'someone@example.com')
  await expect(row.getByTestId('invite-sent-resend')).toBeVisible()
  // Invite links fail closed without the server: no made-up link.
  await page.goto('/invites/new')
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await expect(page.getByText('Invite links work once sync arrives')).toBeVisible()
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
  // Only inside Invite people (26.18 decision 77): the Home header has no overflow.
  await expect(page.getByTestId('people-more')).toHaveCount(0)
  await openAddFriend(page)
  await page.getByTestId('add-friend-invite-link').click()
  await expect(page.getByTestId('screen-create-invite')).toBeVisible()
  await page.getByTestId('invite-uses-5').click()
  await page.getByTestId('invite-expiry-24h').click()
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('invite-qr')).toBeVisible()
  await expect(page.getByTestId('invite-details')).toHaveText('5 of 5 uses left · Expires in 1 day')
  const url = await page.getByTestId('invite-url').textContent()
  const code = url!.split('/').pop()!

  await page.getByTestId('sheet-cancel').click() // "Manage links"
  // F-621: "Manage links" opens the Invite links section of Settings > Friends and invites.
  await expect(page.getByTestId('screen-friends-invites')).toBeVisible()
  await expect(page).toHaveURL(/\/settings\/friends/)
  const row = page.getByTestId(`invite-link-${code}`)
  await expect(row.getByTestId('invite-link-details')).toHaveText('5 of 5 uses left · Expires in 1 day')
  // The seeded group link shows its uses and approval.
  await expect(page.getByText('22 of 25 uses left · Expires in 26 days · You approve each join')).toBeVisible()
  await row.getByTestId('invite-link-revoke').click()
  await expect(page.getByText('Revoke this invite link?')).toBeVisible()
  await page.getByTestId('confirmBtn').click()
  await expect(row).toHaveCount(0)

  // Opening your own revoked link says it no longer works.
  await page.goto(`/invite/${code}`)
  await expect(page.getByTestId('invite-own')).toContainText('Revoked')
})

test('group invite: approve each join, from the Add members sheet only', async ({page}) => {
  await openDemo(page)
  await page.getByTestId('tab-groups').click()
  await page.getByTestId('screen-groups').getByTestId('group-Goa trip').click()
  // Not in the group overflow (26.18 decision 77).
  await page.getByTestId('group-more').click()
  await expect(page.getByTestId('group-menu-add-members')).toBeVisible()
  await expect(page.getByTestId('group-menu-invite-link')).toHaveCount(0)
  await page.getByTestId('group-menu-add-members').click()
  await page.getByTestId('add-members-sheet').getByTestId('add-members-invite-link').click()
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
  await expect(page.getByTestId('person-name')).toHaveText(/^Ananya Gupta( - Demo)?$/)
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
  await enterDemo(page, '/people')
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

test('Settings > Privacy has the directory choice and links to Friends and invites, which owns the rest', async ({page}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/settings')
  await expect(page.getByTestId('settings-privacy-value')).toHaveText('Findable')
  await page.getByTestId('settings-privacy').click()
  await expect(page.getByTestId('pref-privacy.findByContact')).toBeVisible()
  await expect(page.getByTestId('pref-privacy.friendRequestsFrom')).toHaveCount(0)
  await expect(page.getByTestId('pref-invites.defaultExpiry')).toHaveCount(0)
  await page.getByTestId('settings-privacy-friends').click()
  await expect(page.getByTestId('pref-privacy.friendRequestsFrom')).toBeVisible()
  await expect(page.getByTestId('screen-friends-invites').getByTestId('pref-privacy.findByContact')).toHaveCount(0)
  await page.getByTestId('invites.defaultMaxUses.friend-5').click()
  await expect(page.getByTestId('invites.defaultMaxUses.friend-5')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('pref-invites.defaultExpiry')).toBeVisible()
})

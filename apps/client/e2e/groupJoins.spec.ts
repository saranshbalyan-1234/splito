import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-269 (owners 196, 197): every group says who can join, and adding someone asks them. At 390 and 1440 on the demo
 * set: each rule (New group, the Add members sheet, the link page), the join-request approve flow, a group request
 * Join and Decline, invited members that cannot be picked, and the group requests in Activity.
 */
const SIZES = [
  ['390', {width: 390, height: 844}],
  ['1440', {width: 1440, height: 900}],
] as const

const POLICIES = [
  ['link', 'Anyone with the link can join'],
  ['approve', 'Joining by link needs an admin’s approval'],
  ['invite', 'Invite only: people join when a member adds them'],
] as const

const groups = (page: Page) => page.getByTestId('screen-groups').last()

async function openGoa(page: Page) {
  await page.getByTestId('tab-groups').click()
  await groups(page).getByTestId('group-Goa trip').click()
  await page.getByTestId('group-tab-members').click()
}

for (const [size, viewport] of SIZES) {
  test.describe(`at ${size}px`, () => {
    test.beforeEach(async ({page}) => {
      await page.setViewportSize(viewport)
    })

    for (const [policy, rule] of POLICIES) {
      test(`New group: "${policy}" is saved and shown under Members`, async ({page}) => {
        await openDemo(page, '/groups')
        await page.getByTestId('groups-new').click()
        await page.getByTestId('create-group-name').fill(`Rule ${policy}`)
        await page.getByTestId(`join-policy-${policy}`).click()
        await page.getByTestId('sheet-save').click()
        await page.getByTestId('group-tab-members').click()
        await expect(page.getByTestId('group-join-rule')).toHaveText(rule)
      })
    }

    test('the Add members sheet changes the rule: invite only has no link, the others do', async ({page}) => {
      await openDemo(page, '/groups')
      await openGoa(page)
      await expect(page.getByTestId('group-join-rule')).toHaveText('Joining by link needs an admin’s approval')
      await page.getByTestId('group-add-members').click()
      const sheet = page.getByTestId('add-members-sheet')
      await expect(sheet.getByTestId('add-members-invite-link')).toBeVisible()
      await sheet.getByTestId('add-members-join-policy-invite').click()
      await expect(sheet.getByTestId('add-members-no-link')).toBeVisible()
      await expect(sheet.getByTestId('add-members-invite-link')).toHaveCount(0)
      await sheet.getByTestId('add-members-join-policy-link').click()
      await expect(sheet.getByTestId('add-members-invite-link')).toBeVisible()
      await sheet.getByTestId('add-members-invite-link').click()
      await expect(page.getByTestId('invite-join-rule')).toHaveText('Anyone with the link can join')
    })

    test('Edit group changes the rule', async ({page}) => {
      await openDemo(page, '/groups')
      await openGoa(page)
      await page.getByTestId('group-more').click()
      await page.getByTestId('group-menu-edit').click()
      await page.getByTestId('edit-join-policy-invite').click()
      await page.getByTestId('sheet-save').click()
      await expect(page.getByTestId('group-join-rule')).toHaveText('Invite only: people join when a member adds them')
    })

    test('a join request is approved from the Groups tab and the person becomes a member', async ({page}) => {
      await openDemo(page, '/groups')
      const row = groups(page).getByTestId('join-request-Maya Chen')
      await expect(row).toContainText('Wants to join Goa trip')
      // It is shown on the group page under Members as well, with the same answer.
      await row.getByTestId('join-request-approve').click()
      await expect(row).toHaveCount(0)
      await openGoa(page)
      await expect(page.getByTestId('member-Maya Chen')).toBeVisible()
      await expect(page.getByTestId('screen-group').last().getByTestId('join-request-Ananya Gupta')).toBeVisible()
    })

    test('a join request can be declined', async ({page}) => {
      await openDemo(page, '/groups')
      const row = groups(page).getByTestId('join-request-Ananya Gupta')
      await row.getByTestId('join-request-decline').click()
      await expect(row).toHaveCount(0)
      await openGoa(page)
      await expect(page.getByTestId('member-Ananya Gupta')).toHaveCount(0)
    })

    test('"X added you to G": Join opens the group, Decline drops the row', async ({page}) => {
      await openDemo(page, '/groups')
      const pune = groups(page).getByTestId('group-invite-Pune cabin weekend')
      await expect(pune).toContainText('Added you to Pune cabin weekend')
      await groups(page).getByTestId('group-invite-Office lunch club').getByTestId('group-request-decline').click()
      await expect(groups(page).getByTestId('group-invite-Office lunch club')).toHaveCount(0)
      await pune.getByTestId('group-request-join').click()
      await expect(page.getByTestId('screen-group')).toContainText('Pune cabin weekend')
      await page.getByTestId('tab-groups').click()
      await expect(groups(page).getByTestId('group-Pune cabin weekend')).toBeVisible()
      await expect(groups(page).getByTestId('group-invite-Pune cabin weekend')).toHaveCount(0)
    })

    test('the Groups top section shows five rows at most, then See all opens Friends and invites in Activity', async ({page}) => {
      await openDemo(page, '/groups')
      const section = groups(page).getByTestId('groups-requests')
      await expect(section).toBeVisible()
      // Every request row has one actions block (`<row>-actions`): five at most, and more than five adds "See all".
      expect(await section.locator('[data-testid$="-actions"]').count()).toBe(5)
      await section.getByTestId('groups-requests-all').click()
      await expect(page).toHaveURL(/\/activity.*type=friends/)
      await expect(page.getByTestId('screen-activity').last().getByTestId('activity-groupRequest.invited').first()).toBeVisible()
    })

    test('an invited member is shown Invited and cannot be picked', async ({page}) => {
      await openDemo(page, '/groups')
      await openGoa(page)
      // Under Members: waiting, not a member.
      const screen = page.getByTestId('screen-group').last()
      await expect(screen.getByTestId('group-invite-sent-Tanvi Rao')).toContainText('Invited to Goa trip')
      await expect(screen.getByTestId('member-Tanvi Rao')).toHaveCount(0)
      // Not offered again in the Add members sheet, shown greyed.
      await page.getByTestId('group-add-members').click()
      const sheet = page.getByTestId('add-members-sheet')
      await expect(sheet.getByTestId('invited-Tanvi Rao')).toBeVisible()
      await expect(sheet.getByTestId('add-member-Tanvi Rao')).toHaveCount(0)
      await page.keyboard.press('Escape')
      // And not selectable when splitting an expense in the group.
      await page.getByTestId('group-tab-expenses').click()
      await page.getByTestId(size === '390' ? 'fab-add' : 'sidebar-add').click()
      await expect(page.getByTestId('screen-add-expense')).toBeVisible()
      await page.getByTestId('expense-people').click()
      await expect(page.getByTestId('people-dialog').getByTestId('invited-Tanvi Rao')).toBeVisible()
      await expect(page.getByTestId('person-option-Tanvi Rao')).toHaveCount(0)
    })

    test('group requests are in Activity with their answers in the row', async ({page}) => {
      await openDemo(page, '/activity?type=friends')
      const screen = page.getByTestId('screen-activity').last()
      const join = screen.getByTestId('activity-groupRequest.joinRequested').filter({hasText: 'Maya Chen'})
      await join.scrollIntoViewIfNeeded()
      await expect(join).toContainText('asked to join')
      await join.getByTestId('join-request-approve').click()
      await expect(join.getByTestId('join-request-approve')).toHaveCount(0)
      const invited = screen.getByTestId('activity-groupRequest.invited').filter({hasText: 'Office lunch club'})
      await invited.scrollIntoViewIfNeeded()
      await invited.getByTestId('group-request-decline').click()
      await expect(invited.getByTestId('group-request-join')).toHaveCount(0)
    })

    test('opening a group link follows the rule: joins at once, asks, or is broken when invite only', async ({page}) => {
      await openDemo(page, '/')
      await page.goto('/invite/beachlink2026')
      await expect(page.getByTestId('invite-preview')).toContainText('invited you to join Beach cleanup crew')
      await page.getByTestId('invite-accept').click()
      await expect(page.getByTestId('screen-group')).toContainText('Beach cleanup crew')

      await page.goto('/invite/gamesask2026')
      await expect(page.getByTestId('invite-accept')).toHaveText('Ask to join')
      await page.getByTestId('invite-accept').click()
      await expect(groups(page).getByTestId('group-join-sent-Board games night')).toContainText('Waiting for an admin to approve')
      await groups(page).getByTestId('group-join-sent-Board games night').getByTestId('group-request-cancel').click()
      await expect(groups(page).getByTestId('group-join-sent-Board games night')).toHaveCount(0)

      await page.goto('/invite/runonly2026')
      await expect(page.getByTestId('invite-broken')).toBeVisible()
    })
  })
}

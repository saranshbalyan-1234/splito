import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/* F-226: Send feedback, Your feedback, the drawer item and the Settings Support section. */

const PHONE = {width: 390, height: 844}
const DESKTOP = {width: 1440, height: 900}

async function send(page: Page, message: string, type = 'bug') {
  await page.getByTestId(`feedback-type-${type}`).click()
  await page.getByTestId('feedback-message').fill(message)
  await page.getByTestId('sheet-save').click()
  await expect(page.getByTestId('feedback-saved')).toBeVisible()
}

test('Settings has a Support section with Send feedback, Your feedback, Help and About', async ({
  page,
}) => {
  await page.goto('/settings')
  for (const id of [
    'settings-send-feedback',
    'settings-your-feedback',
    'settings-help',
    'settings-about',
  ]) {
    await expect(page.getByTestId(id)).toBeVisible()
  }
  await page.getByTestId('settings-your-feedback').click()
  await expect(page).toHaveURL(/\/settings\/feedback$/)
  await expect(page.getByTestId('feedback-empty')).toBeVisible()
})

test('the drawer footer opens the Send feedback sheet as a bottom drawer on phones', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openDemo(page)
  await expect(page.getByTestId('person-Arjun Mehta')).toBeVisible()
  await page.getByTestId('header-avatar').click()
  await page.getByTestId('nav-footer-feedback').click()
  const sheet = page.getByTestId('feedback-sheet')
  await expect(sheet).toBeVisible()
  /* The sheet rises from the bottom edge; wait for it to come to rest. */
  await expect
    .poll(async () => {
      const box = (await sheet.boundingBox())!
      return [Math.round(box.y + box.height), Math.round(box.width)]
    })
    .toEqual([PHONE.height, PHONE.width])
})

test('Save stays off until the message is long enough, and says why', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.getByTestId('settings-send-feedback').click()
  await expect(page.getByTestId('feedback-sheet')).toBeVisible()
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await expect(page.getByTestId('feedback-message-hint')).toContainText(
    'at least 10',
  )
  await page.getByTestId('feedback-message').fill('Too short')
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
  await page.getByTestId('feedback-message').fill('This is long enough')
  await expect(page.getByTestId('sheet-save')).toBeEnabled()
  await page.getByTestId('feedback-email').fill('not an email')
  await expect(page.getByTestId('feedback-email-hint')).toContainText(
    "doesn't look like",
  )
  await expect(page.getByTestId('sheet-save')).toBeDisabled()
})

test('app info is shown exactly and can be switched off', async ({page}) => {
  await page.goto('/settings')
  await page.getByTestId('settings-send-feedback').click()
  const preview = page.getByTestId('feedback-info-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Version')
  await expect(preview).toContainText('Settings')
  await expect(preview).toContainText('Never amounts, names, notes or receipts')
  await page.getByTestId('feedback-include-info').click()
  await expect(preview).toBeHidden()
  await expect(page.getByTestId('feedback-info-off')).toBeVisible()
})

test('saving keeps the feedback on this device and never says sent', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/settings')
  await page.getByTestId('settings-send-feedback').click()
  await send(page, 'The total on the group page looks off by a rupee')
  await expect(page.getByTestId('feedback-saved')).toContainText(
    'Saved on this device',
  )
  await expect(page.getByTestId('feedback-saved')).toContainText(
    "hasn't been sent anywhere yet",
  )
  await page.getByTestId('feedback-see-all').click()
  await expect(page).toHaveURL(/\/settings\/feedback$/)
  const list = page.getByTestId('feedback-list')
  await expect(list).toContainText('The total on the group page looks off')
  await expect(list).toContainText('Saved on this device')
  await expect(list).not.toContainText('Sent')

  /* It survives a reload: it is in the local store. */
  await page.reload()
  await expect(page.getByTestId('feedback-list')).toContainText(
    'The total on the group page looks off',
  )
})

test('a feedback item can be deleted', async ({page}) => {
  await page.goto('/settings')
  await page.getByTestId('settings-send-feedback').click()
  await send(page, 'Delete me after the test run', 'other')
  await page.getByTestId('sheet-cancel').click()
  await page.goto('/settings/feedback')
  const list = page.getByTestId('feedback-list')
  await expect(list).toContainText('Delete me after the test run')
  await list.locator('[data-testid^="feedback-delete-"]').first().click()
  await page.getByTestId('confirmBtn').click()
  await expect(page.getByTestId('feedback-empty')).toBeVisible()
})

test('a picture can be attached and removed', async ({page}) => {
  await page.goto('/settings')
  await page.getByTestId('settings-send-feedback').click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('feedback-attach').click()
  /* An 8x8 PNG. */
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGOQq/iPFTEMLQkAV9FlQe/oL2QAAAAASUVORK5CYII=',
    'base64',
  )
  await (await chooser).setFiles({name: 'shot.png', mimeType: 'image/png', buffer: png})
  await expect(page.getByTestId('feedback-attachment')).toBeVisible()
  await page.getByTestId('feedback-attachment-remove').click()
  await expect(page.getByTestId('feedback-attach')).toBeVisible()
})

test('Appearance has no shake switch, and the old Motion link lands on Appearance (F-251)', async ({page}) => {
  await page.goto('/settings/motion')
  await expect(page).toHaveURL(/\/settings\/appearance$/)
  await expect(page.getByTestId('pref-haptics')).toBeVisible()
  await expect(page.getByTestId('pref-shakeToFeedback')).toHaveCount(0)
})

import {type Page} from '@playwright/test'

/** The Activity screen on top: web keeps earlier pages of the stack mounted (hidden), so take the last one. */
export const activityScreen = (page: Page) => page.getByTestId('screen-activity').last()

/** The feed rows (`activity-<kind>.<id>`) on the Activity screen on top. */
export const activityRows = (page: Page) => activityScreen(page).locator('[data-testid^="activity-"][data-testid*="."]')

/** The sorted, distinct row kinds listed (`expense.edited`, `group.created`, ...). */
export const activityKinds = async (page: Page) =>
  [...new Set((await activityRows(page).evaluateAll(els => els.map(e => e.getAttribute('data-testid')!))).map(id => id.replace(/^activity-/, '').split('.')[0]!))].sort()

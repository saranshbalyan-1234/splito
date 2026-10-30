/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {activityQuery} from './projections'

/* A comment or a reminder is an Activity event, so its commit must refresh the feed (it did not until F-259). */
test('every entity type the Activity feed reads refreshes it', () => {
  for (const type of ['person', 'group', 'expense', 'repayment', 'writeoff', 'friendRequest', 'reminder', 'comment'] as const)
    expect([type, activityQuery.isTouchedBy({[type]: new Set(['x'])})]).toEqual([type, true])
  expect(activityQuery.isTouchedBy({preference: new Set(['theme'])})).toBe(false)
})

import {expect, test} from 'bun:test'

import {type ActivityEvent} from '@splito/sync'

import {ALL_ACTIVITY, buildRows, EMPTY_FEED_STATE} from './feed'

/** Profile of the Activity tab's row build at ARCHITECTURE's 1,000-row target. */
test('buildRows over 1,000 events stays inside the 50 ms long-task budget', () => {
  const events = Array.from({length: 1000}, (_, i) => ({
    id: `e${i}`,
    at: 1_800_000_000_000 - i * 3_600_000,
    actor: i % 3 ? 'other' : 'me',
  })) as unknown as ActivityEvent[]
  buildRows(events, EMPTY_FEED_STATE, 'me', ALL_ACTIVITY, 'Asia/Kolkata') // warm the formatter
  const t = performance.now()
  buildRows(events, EMPTY_FEED_STATE, 'me', ALL_ACTIVITY, 'Asia/Kolkata')
  const ms = performance.now() - t
  console.log(`buildRows 1000 events: ${ms.toFixed(2)} ms`)
  expect(ms).toBeLessThan(50)
})

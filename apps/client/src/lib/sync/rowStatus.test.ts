import {expect, test} from 'bun:test'

import {isUnsynced, rowStatusKind} from './rowStatus'

test('a queued row is only "saved on this device" until there is an account to send it to', () => {
  expect(rowStatusKind('pending', false)).toBe('device')
  expect(rowStatusKind('pending', true)).toBe('waiting')
  expect(rowStatusKind('local', true)).toBe('local')
})

test('synced is only ever a row the server acknowledged, and only with an account; a refusal needs attention', () => {
  expect(rowStatusKind('synced', true)).toBe('synced')
  expect(rowStatusKind('synced', false)).toBe('device') // sample data marked synced is never called synced
  expect(rowStatusKind('syncing', true)).toBe('syncing')
  expect(rowStatusKind('failed', true)).toBe('attention')
})

test('a row is drawn lighter until the server acknowledges it; a refusal keeps full strength', () => {
  for (const status of ['local', 'pending', 'syncing'] as const) expect(isUnsynced(status)).toBe(true)
  for (const status of ['synced', 'failed'] as const) expect(isUnsynced(status)).toBe(false)
})

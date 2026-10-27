import {expect, test} from 'bun:test'

import {ROW_STATUS_TONE, rowStatusKind} from './rowStatus'

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

test('the dot is green only when synced, yellow while on its way, red when only here or refused', () => {
  expect(ROW_STATUS_TONE.synced).toBe('positive')
  expect(ROW_STATUS_TONE.waiting).toBe('warning')
  expect(ROW_STATUS_TONE.syncing).toBe('warning')
  expect([ROW_STATUS_TONE.local, ROW_STATUS_TONE.device, ROW_STATUS_TONE.attention]).toEqual(['negative', 'negative', 'negative'])
})

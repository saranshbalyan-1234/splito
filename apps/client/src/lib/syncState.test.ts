import {describe, expect, test} from 'bun:test'

import {syncDotState} from './syncState'

describe('syncDotState', () => {
  test('no account is red, whatever else is true', () => {
    expect(syncDotState({hasSession: false, isOnline: true, pendingOps: 0})).toBe('local')
    expect(syncDotState({hasSession: false, isOnline: false, pendingOps: 3})).toBe('local')
  })
  test('green only when online with nothing waiting', () => {
    expect(syncDotState({hasSession: true, isOnline: true, pendingOps: 0})).toBe('synced')
  })
  test('yellow while changes wait or the device is offline', () => {
    expect(syncDotState({hasSession: true, isOnline: true, pendingOps: 2})).toBe('syncing')
    expect(syncDotState({hasSession: true, isOnline: false, pendingOps: 0})).toBe('syncing')
  })
})

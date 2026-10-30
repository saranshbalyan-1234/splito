import {describe, expect, test} from 'bun:test'

import {canDispute, canResolveDispute, type DisputeRecord, type DisputeState} from '../src/permissions'

const record: DisputeRecord = {
  addedBy: 'adder',
  participants: ['adder', 'payer', 'bob'],
  payers: ['payer'],
  groupMembers: ['adder', 'payer', 'bob', 'cara', 'admin'],
  groupAdmins: ['admin'],
}
const open: DisputeState = {raisedBy: 'bob', recordedBy: 'bob', kind: 'dispute', status: 'open', reopenCount: 0}
const can = (d: Partial<DisputeState>, actor: string, action: Parameters<typeof canResolveDispute>[3], r = record) =>
  canResolveDispute(r, {...open, ...d}, actor, action).ok

describe('canDispute', () => {
  test('a participant may dispute or hold', () => {
    expect(canDispute(record, {raisedBy: 'bob', kind: 'dispute', reason: 'wrong_amount'}, false).ok).toBe(true)
    expect(canDispute(record, {raisedBy: 'bob', kind: 'hold', reason: 'other'}, false).ok).toBe(true)
  })
  test('a group member who is not on it may only say they were left out', () => {
    expect(canDispute(record, {raisedBy: 'cara', kind: 'dispute', reason: 'left_out'}, false).ok).toBe(true)
    expect(canDispute(record, {raisedBy: 'cara', kind: 'dispute', reason: 'wrong_amount'}, false)).toEqual({ok: false, code: 'NOT_A_PARTICIPANT'})
    expect(canDispute(record, {raisedBy: 'cara', kind: 'hold', reason: 'other'}, false).ok).toBe(false)
  })
  test('a participant was not left out', () => {
    expect(canDispute(record, {raisedBy: 'bob', kind: 'dispute', reason: 'left_out'}, false)).toEqual({ok: false, code: 'ALREADY_PARTICIPANT'})
  })
  test('a stranger, outside the group, cannot', () => {
    expect(canDispute(record, {raisedBy: 'zed', kind: 'dispute', reason: 'left_out'}, false).ok).toBe(false)
    expect(canDispute({...record, groupMembers: []}, {raisedBy: 'cara', kind: 'dispute', reason: 'left_out'}, false).ok).toBe(false)
  })
  test('one open dispute per person per record', () => {
    expect(canDispute(record, {raisedBy: 'bob', kind: 'dispute', reason: 'wrong_amount'}, true)).toEqual({ok: false, code: 'ALREADY_OPEN'})
  })
})

describe('canResolveDispute', () => {
  test('the adder, the payer and an admin answer', () => {
    for (const who of ['adder', 'payer', 'admin']) {
      expect(can({}, who, 'accept')).toBe(true)
      expect(can({}, who, 'reject')).toBe(true)
    }
  })
  test('the raiser cannot answer their own dispute, only withdraw it', () => {
    expect(can({raisedBy: 'adder', recordedBy: 'adder'}, 'adder', 'accept')).toBe(false)
    expect(can({raisedBy: 'adder', recordedBy: 'adder'}, 'adder', 'reject')).toBe(false)
    expect(can({}, 'bob', 'accept')).toBe(false)
    expect(can({}, 'bob', 'withdraw')).toBe(true)
  })
  test('someone else on the record cannot answer or withdraw', () => {
    expect(can({}, 'cara', 'accept')).toBe(false)
    expect(can({}, 'cara', 'withdraw')).toBe(false)
  })
  test('the person who recorded it for the raiser may withdraw and still answer', () => {
    const d = {raisedBy: 'bob', recordedBy: 'adder'}
    expect(can(d, 'adder', 'withdraw')).toBe(true)
    expect(can(d, 'adder', 'accept')).toBe(true)
  })
  test('nothing is answered once it is closed', () => {
    for (const status of ['accepted', 'rejected', 'withdrawn', 'released', 'gone'] as const) {
      expect(can({status}, 'adder', 'accept')).toBe(false)
      expect(can({status}, 'bob', 'withdraw')).toBe(false)
    }
  })
  test('a hold is released by any participant, not answered', () => {
    const hold = {kind: 'hold' as const}
    expect(can(hold, 'payer', 'release')).toBe(true)
    expect(can(hold, 'bob', 'release')).toBe(true)
    expect(can(hold, 'admin', 'release')).toBe(true)
    expect(can(hold, 'cara', 'release')).toBe(false)
    expect(can(hold, 'adder', 'accept')).toBe(false)
    expect(can({}, 'bob', 'release')).toBe(false)
  })
  test('the raiser reopens a rejection once, then only an admin', () => {
    const rejected = {status: 'rejected' as const}
    expect(can(rejected, 'bob', 'reopen')).toBe(true)
    expect(can(rejected, 'cara', 'reopen')).toBe(false)
    expect(can({...rejected, reopenCount: 1}, 'bob', 'reopen')).toBe(false)
    expect(can({...rejected, reopenCount: 1}, 'admin', 'reopen')).toBe(true)
    expect(can({}, 'bob', 'reopen')).toBe(false)
  })
  test('after a reopen only a group admin answers; outside a group the adder or payer still does', () => {
    const reopened = {reopenCount: 1}
    expect(can(reopened, 'adder', 'accept')).toBe(false)
    expect(can(reopened, 'payer', 'reject')).toBe(false)
    expect(can(reopened, 'admin', 'accept')).toBe(true)
    expect(can(reopened, 'admin', 'reject')).toBe(true)
    const direct = {...record, groupMembers: [], groupAdmins: []}
    expect(can(reopened, 'adder', 'accept', direct)).toBe(true)
    expect(can(reopened, 'payer', 'reject', direct)).toBe(true)
    // ...and a second reopen is refused there: nobody is an admin.
    expect(can({status: 'rejected', reopenCount: 1}, 'bob', 'reopen', direct)).toBe(false)
    expect(can({status: 'rejected', reopenCount: 1}, 'adder', 'reopen', direct)).toBe(false)
  })
  test('outside a group nobody is an admin', () => {
    const direct = {...record, groupMembers: [], groupAdmins: []}
    expect(can({status: 'rejected', reopenCount: 1}, 'admin', 'reopen', direct)).toBe(false)
    expect(can({}, 'adder', 'accept', direct)).toBe(true)
  })
})

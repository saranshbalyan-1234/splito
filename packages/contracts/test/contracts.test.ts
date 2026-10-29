import {afterAll, expect, test} from 'bun:test'
import {
  createExpense,
  createPerson,
  deleteExpense,
  encode,
  ensureMe,
  openSqlStore,
  setPref,
} from '@splito/sync'
import {bunExecutor} from '@splito/sync/test/bunExecutor'
import {Settings} from 'typebox/system'
import {Value} from 'typebox/value'

import {
  ERRORS,
  ErrorEnvelope,
  MAX_PUSH_OPS,
  OpAck,
  PullRequest,
  PushRequest,
  SyncOp,
} from '../src'

/** Real outbox ops from @splito/sync, sent the way a client sends them: through the codec. */
async function realOps() {
  let n = 0
  const ctx = {
    deviceId: 'd1',
    actor: 'me',
    now: () => 1000 + n,
    newId: () => 'id' + ++n,
  }
  const s = await openSqlStore(bunExecutor(':memory:'))
  await ensureMe(s, ctx, 'Me')
  const p = await createPerson(s, ctx, {name: 'Riya'})
  const draft = {
    title: 'Dinner',
    groupId: null,
    currency: 'INR' as const,
    total: 999_999_999_999_999n,
    payers: {me: 999_999_999_999_999n},
    split: {mode: 'equal' as const, participants: ['me', p.id]},
    date: '2026-10-26',
    tz: 'Asia/Kolkata',
    category: 'food',
    notes: '',
  }
  const e = await createExpense(s, ctx, draft)
  await deleteExpense(s, ctx, e.id)
  await setPref(s, ctx, 'theme', 'dark')
  const ops = await s.outbox()
  await s.close()
  return JSON.parse(encode({ops})) as {ops: Array<Record<string, unknown>>}
}

const op = (over: Partial<SyncOp> = {}): SyncOp => ({
  opId: 'o1',
  deviceId: 'd1',
  actor: 'me',
  entityType: 'expense',
  entityId: 'e1',
  opType: 'expense.create',
  baseVersion: 0,
  payload: {total: {$bigint: '100'}},
  schemaVersion: 1,
  deps: [],
  ...over,
})

afterAll(() => Settings.Reset())

for (const useAcceleration of [true, false]) {
  test(`@splito/sync outbox ops satisfy the push contract (useAcceleration=${useAcceleration})`, async () => {
    Settings.Set({useAcceleration})
    const body = await realOps()
    expect(body.ops.map(o => o.opType)).toEqual([
      'person.create',
      'person.create',
      'expense.create',
      'expense.delete',
      'preference.set',
    ])
    expect((body.ops[2]!.payload as {total: unknown}).total).toEqual({
      $bigint: '999999999999999',
    })
    expect([...Value.Errors(PushRequest, body)]).toEqual([])
  })
}

test('batch bound is MAX_PUSH_OPS', () => {
  expect(
    Value.Check(PushRequest, {
      ops: Array.from({length: MAX_PUSH_OPS}, () => op()),
    }),
  ).toBe(true)
  expect(
    Value.Check(PushRequest, {
      ops: Array.from({length: MAX_PUSH_OPS + 1}, () => op()),
    }),
  ).toBe(false)
})

test('op shape is enforced', () => {
  expect(Value.Check(SyncOp, op())).toBe(true)
  expect(
    Value.Check(
      SyncOp,
      op({entityType: 'repayment', opType: 'repayment.create'}),
    ),
  ).toBe(true)
  expect(Value.Check(SyncOp, op({entityType: 'post' as never}))).toBe(false)
  expect(Value.Check(SyncOp, op({opType: 'create'}))).toBe(false)
  expect(Value.Check(SyncOp, op({baseVersion: -1}))).toBe(false)
  expect(Value.Check(SyncOp, op({baseVersion: 1.5}))).toBe(false)
  expect(Value.Check(SyncOp, op({payload: 'x' as never}))).toBe(false)
  expect(Value.Check(SyncOp, op({schemaVersion: 2 as never}))).toBe(false)
  expect(Value.Check(SyncOp, op({opId: ''}))).toBe(false)
})

test('error envelope and codes', () => {
  expect(Object.keys(ERRORS)).toEqual([
    'VALIDATION',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'CONFLICT',
    'CURSOR_EXPIRED',
    'RATE_LIMITED',
    'INTERNAL',
  ])
  expect(
    Value.Check(ErrorEnvelope, {
      error: {code: 'CURSOR_EXPIRED', message: 'x', retryable: false},
    }),
  ).toBe(true)
  expect(
    Value.Check(ErrorEnvelope, {
      error: {code: 'NOPE', message: 'x', retryable: false},
    }),
  ).toBe(false)
})

test('acks and pull request', () => {
  expect(Value.Check(OpAck, {opId: 'o1', status: 'applied', revision: 1})).toBe(
    true,
  )
  const error = {code: 'CONFLICT', message: 'stale', retryable: false}
  expect(
    Value.Check(OpAck, {opId: 'o1', status: 'conflict', error, server: null}),
  ).toBe(true)
  expect(Value.Check(OpAck, {opId: 'o1', status: 'conflict', error})).toBe(
    false,
  )
  expect(Value.Check(PullRequest, {cursor: null})).toBe(true)
  expect(Value.Check(PullRequest, {cursor: 'abc', limit: 501})).toBe(false)
})

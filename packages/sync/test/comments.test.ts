import {beforeEach, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {
  COMMENT_MAX_LENGTH,
  type Comment,
  commentCount,
  createComment,
  deleteComment,
  editComment,
  listComments,
  mentionRanges,
} from '../src/comments'
import {createExpense, createPerson, deleteExpense, ensureMe, type ExpenseDraft} from '../src/mutations'
import {getPref, PREFS} from '../src/preferences'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let other: MutationCtx
let n = 0
let expenseId = ''
beforeEach(async () => {
  n = 0
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => 1000 + n * 10, newId: () => 'id' + ++n}
  other = {...ctx, actor: 'riya'}
  await ensureMe(s, ctx, 'Me')
  await s.transaction(async tx => tx.put({type: 'person', id: 'riya', data: {name: 'Riya', isMe: false}, version: 1, deleted: false, updatedAt: 1}))
  const draft: ExpenseDraft = {
    title: 'Dinner',
    groupId: null,
    currency: 'INR',
    total: 200n,
    payers: {me: 200n},
    split: {mode: 'equal', participants: ['me', 'riya']},
    date: '2026-10-26',
    tz: 'Asia/Kolkata',
    category: 'food',
    notes: '',
  }
  expenseId = (await createExpense(s, ctx, draft)).id
})

const add = (body: string, over: Partial<Parameters<typeof createComment>[2]> = {}) =>
  createComment(s, ctx, {targetType: 'expense', targetId: expenseId, body, ...over})

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.catch(x => x)
  expect(e).toBeInstanceOf(DomainError)
  expect((e as DomainError).code).toBe(code)
}

test('creates a comment: trimmed, authored by me, with history and one outbox op', async () => {
  const before = (await s.outbox()).length
  const c = await add('  Who has the bill?  ')
  expect(c.data).toEqual({targetType: 'expense', targetId: expenseId, authorId: 'me', body: 'Who has the bill?', mentions: [], editedAt: null})
  expect(c.syncStatus).toBe('pending')
  expect(await s.history('comment', c.id)).toHaveLength(1)
  const ops = (await s.outbox()).slice(before)
  expect(ops.map(o => [o.opType, o.entityId])).toEqual([['comment.create', c.id]])
})

test('create is idempotent on a given id', async () => {
  const a = await add('Hello', {id: 'c1'})
  const b = await add('Hello again', {id: 'c1'})
  expect(b.id).toBe(a.id)
  expect(b.data.body).toBe('Hello')
  expect((await listComments(s, 'expense', expenseId)).items).toHaveLength(1)
})

test('rejects empty, too long, unknown targets and unknown mentions', async () => {
  await fails(add('   '), 'EMPTY_COMMENT')
  await fails(add('x'.repeat(COMMENT_MAX_LENGTH + 1)), 'COMMENT_TOO_LONG')
  await fails(createComment(s, ctx, {targetType: 'expense', targetId: 'nope', body: 'hi'}), 'NOT_FOUND')
  await fails(createComment(s, ctx, {targetType: 'person' as never, targetId: 'riya', body: 'hi'}), 'INVALID_COMMENT_TARGET')
  await fails(add('hi @Zed', {mentions: ['zed']}), 'UNKNOWN_PERSON')
  await deleteExpense(s, ctx, expenseId)
  await fails(add('late'), 'NOT_FOUND')
})

test('edits only my own comment; the edit is a new version and keeps the old text in history', async () => {
  const c = await add('Frist!')
  const e = await editComment(s, ctx, c.id, {body: 'First!'})
  expect(e.data.body).toBe('First!')
  expect(e.data.editedAt).not.toBeNull()
  expect(e.version).toBe(2)
  const h = await s.history('comment', c.id)
  expect(h.map(r => (r.data as Comment).body)).toEqual(['Frist!', 'First!'])
  await fails(editComment(s, other, c.id, {body: 'hijack'}), 'NOT_YOUR_COMMENT')
  // an unchanged body writes nothing
  expect((await editComment(s, ctx, c.id, {body: 'First!'})).version).toBe(2)
  await fails(editComment(s, ctx, 'missing', {body: 'x'}), 'NOT_FOUND')
})

test('deletes only my own comment: a tombstone with the text stripped, every earlier version kept', async () => {
  const c = await add('Secret plan')
  await fails(deleteComment(s, other, c.id), 'NOT_YOUR_COMMENT')
  await deleteComment(s, ctx, c.id)
  const row = await s.get<Comment>('comment', c.id)
  expect(row?.deleted).toBe(true)
  expect(row?.data.body).toBe('')
  const h = await s.history('comment', c.id)
  expect(h.map(r => [r.deleted, (r.data as Comment).body])).toEqual([[false, 'Secret plan'], [true, '']])
  // a second delete is a no-op, and a deleted comment can't be edited
  await deleteComment(s, ctx, c.id)
  expect(await s.history('comment', c.id)).toHaveLength(2)
  await fails(editComment(s, ctx, c.id, {body: 'back'}), 'NOT_FOUND')
  expect((await s.outbox()).filter(o => o.entityId === c.id).map(o => o.opType)).toEqual(['comment.create', 'comment.delete'])
})

test('a thread pages newest first by cursor and never reads other targets', async () => {
  for (let i = 1; i <= 7; i++) await add(`c${i}`)
  const second = (await createExpense(s, ctx, {
    title: 'Taxi', groupId: null, currency: 'INR', total: 100n, payers: {me: 100n},
    split: {mode: 'equal', participants: ['me']}, date: '2026-10-26', tz: 'Asia/Kolkata', category: 'transport', notes: '',
  })).id
  await createComment(s, ctx, {targetType: 'expense', targetId: second, body: 'elsewhere'})
  const p1 = await listComments(s, 'expense', expenseId, {limit: 3})
  expect(p1.items.map(c => c.data.body)).toEqual(['c7', 'c6', 'c5'])
  const p2 = await listComments(s, 'expense', expenseId, {limit: 3, after: p1.next})
  expect(p2.items.map(c => c.data.body)).toEqual(['c4', 'c3', 'c2'])
  const p3 = await listComments(s, 'expense', expenseId, {limit: 3, after: p2.next})
  expect(p3.items.map(c => c.data.body)).toEqual(['c1'])
  expect(p3.next).toBeNull()
})

test('the count is of live comments only, and 0 costs one index count', async () => {
  expect(await commentCount(s, 'expense', expenseId)).toBe(0)
  const a = await add('one')
  await add('two')
  await add('three')
  expect(await commentCount(s, 'expense', expenseId)).toBe(3)
  await deleteComment(s, ctx, a.id)
  expect(await commentCount(s, 'expense', expenseId)).toBe(2)
  expect(await commentCount(s, 'repayment', expenseId)).toBe(0)
})

test('mentions: stored as person ids, found in the text by name', async () => {
  const c = await add('Thanks @Riya!', {mentions: ['riya', 'riya']})
  expect(c.data.mentions).toEqual(['riya'])
  const people = [{id: 'riya', name: 'Riya'}, {id: 'me', name: 'Me'}, {id: 'ri', name: 'Ri'}]
  expect(mentionRanges('Thanks @Riya! cc @Ri, @Riyanka', people, ['riya', 'ri'])).toEqual([
    {start: 7, end: 12, personId: 'riya'},
    {start: 17, end: 20, personId: 'ri'},
  ])
  // a mention the author never kept is plain text
  expect(mentionRanges('hi @Riya', people, [])).toEqual([])
})

test('comments.showHistory defaults on and is a registered preference', async () => {
  expect(PREFS['comments.showHistory'].default).toBe(true)
  expect(await getPref(s, 'comments.showHistory')).toBe(true)
})

test('a person created later can be mentioned', async () => {
  const p = await createPerson(s, ctx, {name: 'Sam'})
  const c = await add('@Sam look', {mentions: [p.id]})
  expect(c.data.mentions).toEqual([p.id])
})

import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {beforeEach, describe, expect, test} from 'bun:test'

import {loadActivity} from '../src/activity'
import {openIdbStore} from '../src/idbStore'
import {createGroup, createPerson, ensureMe} from '../src/mutations'
import {
  cancelReminder,
  lastNudgeAt,
  nextOccurrence,
  recordNudge,
  remindersAbout,
  scheduleReminder,
  selfReminders,
  updateReminder,
} from '../src/reminders'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

const T0 = Date.parse('2026-10-27T10:00:00Z')

describe.each([
  ['SQLite', () => openSqlStore(bunExecutor(':memory:'))],
  ['IndexedDB', () => openIdbStore('rem', new IDBFactory())],
] as const)('%s reminders', (_name, open) => {
  let s: Store
  let ctx: MutationCtx
  let n = 0
  let riya: string
  let goa: string
  beforeEach(async () => {
    n = 0
    s = await open()
    ctx = {deviceId: 'dev1', actor: 'me', now: () => T0 + n * 1000, newId: () => 'id' + ++n}
    await ensureMe(s, ctx, 'Me')
    riya = (await createPerson(s, ctx, {name: 'Riya'})).id
    goa = (await createGroup(s, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [riya]})).id
  })

  test('a nudge is logged with what was owed per currency, never summed, and stays on this device until a server takes it', async () => {
    const e = await recordNudge(s, ctx, {personId: riya, groupId: null, amounts: {INR: 45000n, JPY: 1200n}, via: 'whatsapp'})
    expect(e.data).toMatchObject({kind: 'nudge', personId: riya, groupId: null, dueAt: null, repeat: 'none', amounts: {INR: 45000n, JPY: 1200n}, via: 'whatsapp'})
    expect(e.syncStatus).toBe('pending')
    expect((await s.outbox()).map(o => o.opType)).toContain('reminder.nudge')
    // Both engines index the same columns.
    expect((await s.page('reminder', {index: 'byPerson', eq: [riya]})).items.map(x => x.id)).toEqual([e.id])
    // A nudge is never a scheduled reminder.
    expect(await selfReminders(s)).toEqual([])
  })

  test('the last nudge to a friend is the newest one, whatever scheduled reminders sit between', async () => {
    expect(await lastNudgeAt(s, riya)).toBeNull()
    const first = await recordNudge(s, ctx, {personId: riya, groupId: null, amounts: {INR: 100n}, via: 'copy'})
    const second = await recordNudge(s, ctx, {personId: riya, groupId: goa, amounts: {INR: 100n}, via: 'share'})
    await scheduleReminder(s, ctx, {personId: riya, groupId: null, dueAt: T0, repeat: 'none'})
    expect(second.createdAt).toBeGreaterThan(first.createdAt)
    expect(await lastNudgeAt(s, riya)).toBe(second.createdAt)
    expect(await lastNudgeAt(s, 'someone-else')).toBeNull()
  })

  test('a nudge needs a friend and at least one positive amount', async () => {
    await expect(recordNudge(s, ctx, {personId: 'nobody', groupId: null, amounts: {INR: 100n}, via: 'share'})).rejects.toThrow('NOT_FOUND')
    await expect(recordNudge(s, ctx, {personId: riya, groupId: null, amounts: {}, via: 'share'})).rejects.toThrow('INVALID_AMOUNT')
    await expect(recordNudge(s, ctx, {personId: riya, groupId: null, amounts: {INR: 0n}, via: 'share'})).rejects.toThrow('INVALID_AMOUNT')
  })

  test('schedule, update and cancel a reminder for myself', async () => {
    const due = T0 + 86_400_000
    const r = await scheduleReminder(s, ctx, {personId: riya, groupId: goa, dueAt: due, repeat: 'weekly'})
    expect(r.data).toMatchObject({kind: 'self', personId: riya, groupId: goa, dueAt: due, repeat: 'weekly'})
    expect((await selfReminders(s)).map(x => x.id)).toEqual([r.id])
    expect((await remindersAbout(s, riya)).map(x => x.id)).toEqual([r.id])
    expect(await s.page('reminder', {index: 'byDue', eq: ['self'], min: due, max: due})).toMatchObject({items: [{id: r.id}]})

    const moved = await updateReminder(s, ctx, r.id, {dueAt: due + 3_600_000, repeat: 'none'})
    expect(moved.version).toBe(2)
    expect(moved.data).toMatchObject({dueAt: due + 3_600_000, repeat: 'none', personId: riya, groupId: goa})

    await cancelReminder(s, ctx, r.id)
    expect(await selfReminders(s)).toEqual([])
    expect(await remindersAbout(s, riya)).toEqual([])
    // Cancelled is a tombstone, never a hard delete.
    expect((await s.get('reminder', r.id))?.deleted).toBe(true)
    await expect(updateReminder(s, ctx, r.id, {dueAt: due, repeat: 'none'})).rejects.toThrow('NOT_FOUND')
  })

  test('a reminder is about a person, a group or both, with a real time and a known repeat', async () => {
    await expect(scheduleReminder(s, ctx, {personId: '', groupId: null, dueAt: T0, repeat: 'none'})).rejects.toThrow('NOT_FOUND')
    await expect(scheduleReminder(s, ctx, {personId: 'nobody', groupId: null, dueAt: T0, repeat: 'none'})).rejects.toThrow('NOT_FOUND')
    await expect(scheduleReminder(s, ctx, {personId: riya, groupId: null, dueAt: Number.NaN, repeat: 'none'})).rejects.toThrow('INVALID_DATE')
    await expect(scheduleReminder(s, ctx, {personId: riya, groupId: null, dueAt: T0, repeat: 'hourly' as never})).rejects.toThrow('INVALID_REPEAT')
    const g = await scheduleReminder(s, ctx, {personId: '', groupId: goa, dueAt: T0, repeat: 'daily'})
    expect(g.data.personId).toBe('')
    expect((await s.page('reminder', {index: 'byPerson', eq: ['']})).items.map(x => x.id)).toEqual([g.id])
  })

  test('Activity shows "reminded" for a nudge and "Reminder set" for a schedule, and nothing for edits and cancels', async () => {
    await recordNudge(s, ctx, {personId: riya, groupId: null, amounts: {INR: 45000n}, via: 'share'})
    const r = await scheduleReminder(s, ctx, {personId: riya, groupId: null, dueAt: T0 + 1000, repeat: 'none'})
    await updateReminder(s, ctx, r.id, {dueAt: T0 + 2000, repeat: 'none'})
    await cancelReminder(s, ctx, r.id)
    const kinds = (await loadActivity(s)).filter(e => e.entityType === 'reminder').map(e => e.kind)
    expect(kinds).toEqual(['reminder.set', 'reminder.nudged'])
  })
})

describe('nextOccurrence', () => {
  const local = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime()

  test('a one-off fires once: its time while ahead, nothing after', () => {
    expect(nextOccurrence(local(2026, 11, 1), 'none', local(2026, 10, 27))).toBe(local(2026, 11, 1))
    expect(nextOccurrence(local(2026, 11, 1), 'none', local(2026, 11, 2))).toBeNull()
  })

  test('daily, weekly and monthly step from the first time to the first one still ahead, at the same local hour', () => {
    expect(nextOccurrence(local(2026, 10, 1), 'daily', local(2026, 10, 27, 12))).toBe(local(2026, 10, 28))
    expect(nextOccurrence(local(2026, 10, 1), 'weekly', local(2026, 10, 27, 12))).toBe(local(2026, 10, 29))
    expect(nextOccurrence(local(2026, 8, 15), 'monthly', local(2026, 10, 27, 12))).toBe(local(2026, 11, 15))
    // Exactly now counts as ahead.
    expect(nextOccurrence(local(2026, 10, 27), 'daily', local(2026, 10, 27))).toBe(local(2026, 10, 27))
  })

  test('a monthly reminder on the 31st lands on the last day of shorter months and comes back to the 31st', () => {
    const first = local(2026, 1, 31)
    expect(nextOccurrence(first, 'monthly', local(2026, 2, 1))).toBe(local(2026, 2, 28))
    expect(nextOccurrence(first, 'monthly', local(2026, 3, 1))).toBe(local(2026, 3, 31))
    expect(nextOccurrence(first, 'monthly', local(2026, 4, 1))).toBe(local(2026, 4, 30))
  })
})

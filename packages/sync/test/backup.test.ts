import {beforeEach, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {
  applyBackup,
  BACKUP_VERSION,
  type BackupFile,
  createBackup,
  parseBackup,
  previewBackup,
  serializeBackup,
  upgradeBackup,
} from '../src/backup'
import {encode} from '../src/codec'
import {createInviteLink, sendFriendRequest} from '../src/friends'
import {saveFeedback} from '../src/feedback'
import {createExpense, createGroup, type ExpenseDraft, createPerson, createRepayment, createWriteOffs, deleteExpense, ensureMe, updateExpense} from '../src/mutations'
import {setPref} from '../src/preferences'
import {ENTITY_TYPES} from '../src/schema'
import {openSqlStore} from '../src/sqlStore'
import {type Store, type Tx} from '../src/store'
import {type EntityType, type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let src: Store
let dst: Store
let n = 0
let clock = 1_000_000
const mk = (actor = 'me'): MutationCtx => ({deviceId: 'dev1', actor, now: () => clock++, newId: () => 'id' + ++n})
let ctx: MutationCtx

beforeEach(async () => {
  src = await openSqlStore(bunExecutor(':memory:'))
  dst = await openSqlStore(bunExecutor(':memory:'))
  clock = 1_000_000
  ctx = mk()
  await ensureMe(src, ctx, 'Me')
  await ensureMe(dst, ctx, 'Me')
})

const code = (e: unknown) => (e instanceof DomainError ? e.code : String(e))

/** One writer per entity type: adding a type to ENTITY_TYPES without one fails the coverage test below. */
const WRITERS = {
  person: async () => {
    await createPerson(src, ctx, {name: 'Asha'})
    await createPerson(src, ctx, {name: 'Ben', contact: {kind: 'email', value: 'ben@example.com'}})
  },
  group: async () => {
    const [asha, ben] = (await src.getAll('person')).filter(p => p.id !== 'me').map(p => p.id)
    await createGroup(src, ctx, {name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [asha!, ben!]})
  },
  expense: async () => {
    const [asha, ben] = (await src.getAll('person')).filter(p => p.id !== 'me').map(p => p.id)
    const [g] = await src.getAll('group')
    await createExpense(src, ctx, {
      title: 'Villa',
      groupId: g!.id,
      currency: 'INR',
      total: 100_000n,
      payers: {me: 60_000n, [asha!]: 40_000n},
      split: {mode: 'shares', shares: {me: 1, [asha!]: 1, [ben!]: 3}},
      date: '2026-10-20',
      tz: 'Asia/Kolkata',
      category: 'stay',
      notes: 'two payers, uneven shares',
    })
    await createExpense(src, ctx, {
      title: 'Taxi in Dubai',
      groupId: null,
      currency: 'AED',
      total: 5_050n,
      payers: {[ben!]: 5_050n},
      split: {mode: 'equal', participants: ['me', ben!]},
      date: '2026-10-21',
      tz: 'Asia/Dubai',
      category: 'transport',
      notes: '',
    })
    const gone = await createExpense(src, ctx, {
      title: 'Oops',
      groupId: null,
      currency: 'INR',
      total: 100n,
      payers: {me: 100n},
      split: {mode: 'equal', participants: ['me', asha!]},
      date: '2026-10-22',
      tz: 'Asia/Kolkata',
      category: 'food',
      notes: '',
    })
    await deleteExpense(src, ctx, gone.id)
  },
  repayment: async () => {
    const asha = (await src.getAll('person')).find(p => p.id !== 'me')!
    await createRepayment(src, ctx, {groupId: null, currency: 'INR', from: asha.id, to: 'me', amount: 1_000n, date: '2026-10-23', tz: 'Asia/Kolkata', note: 'upi'})
  },
  writeoff: async () => {
    const ben = (await src.getAll('person')).find(p => (p.data as {name: string}).name === 'Ben')!
    await createWriteOffs(src, ctx, [{groupId: null, currency: 'AED', from: ben.id, to: 'me', amount: 50n, date: '2026-10-24', tz: 'Asia/Dubai', note: ''}])
  },
  comment: async () => {
    const [e] = await src.getAll('expense')
    await src.transaction(async (tx: Tx) => {
      await tx.put({type: 'comment', id: 'c1', data: {targetType: 'expense', targetId: e!.id, text: 'looks right'}, version: 1, deleted: false, updatedAt: clock++})
    })
  },
  friendRequest: async () => {
    await sendFriendRequest(src, ctx, {contact: {kind: 'email', value: 'zed@example.com'}, name: 'Zed', reach: 'on-splito'})
  },
  inviteLink: async () => {
    await createInviteLink(src, ctx, {kind: 'friend', groupId: null, maxUses: 5, expiresInMs: null, approveJoins: false})
  },
  feedback: async () => {
    await saveFeedback(src, ctx, {type: 'idea', message: 'Please add dark mode', attachment: null, appInfo: null, replyEmail: null})
  },
  preference: async () => {
    await setPref(src, ctx, 'defaultCurrency', 'AED')
    await setPref(src, ctx, 'haptics', false)
  },
} satisfies Record<EntityType, () => Promise<void>>

async function seed() {
  for (const type of ENTITY_TYPES) await WRITERS[type]()
}

/** Everything a restore must preserve: ids, currencies, splits, versions, tombstones, times. Sync bookkeeping is the new device's own. */
async function ledgerOf(s: Store) {
  const d = await s.dump()
  return d.entities
    .map(e => ({type: e.type, id: e.id, data: encode(e.data), version: e.version, deleted: e.deleted, createdAt: e.createdAt, updatedAt: e.updatedAt}))
    .sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id))
}

const roundTrip = async (file: BackupFile) => parseBackup(serializeBackup(file))

test('the writers cover every entity type (a new type needs one)', () => {
  expect(Object.keys(WRITERS).sort()).toEqual([...ENTITY_TYPES].sort())
})

test('A12: every entity type round-trips with ids, currencies, splits, tombstones and times', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  // The backup holds a list for every type, in ENTITY_TYPES order, not a hard-coded set.
  expect(Object.keys(file.entities)).toEqual([...ENTITY_TYPES])
  for (const type of ENTITY_TYPES) expect((await src.getAll(type)).length).toBeGreaterThan(0)
  await applyBackup(dst, ctx, file, 'replace')
  const want = (await ledgerOf(src)).filter(e => !(e.type === 'person' && e.id === 'me'))
  const got = (await ledgerOf(dst)).filter(e => !(e.type === 'person' && e.id === 'me'))
  expect(got).toEqual(want)
  // The derived tables agree too: the money is the same, per currency.
  const net = async (s: Store) => (await s.balances()).map(b => `${b.personId}|${b.groupId}|${b.currency}|${b.amount}`).sort()
  expect(await net(dst)).toEqual(await net(src))
  expect((await net(dst)).length).toBeGreaterThan(0)
})

test('the file is plain JSON with a format, versions and a checksum', async () => {
  await seed()
  const text = serializeBackup(await createBackup(src, ctx))
  const raw = JSON.parse(text)
  expect(raw).toMatchObject({format: 'splito-backup', version: BACKUP_VERSION, meId: 'me'})
  expect(typeof raw.checksum).toBe('string')
  // Amounts are exact: bigint survives as its decimal string.
  expect(text).toContain('"$bigint":"100000"')
})

test('a corrupt file is rejected and nothing is applied', async () => {
  await seed()
  const text = serializeBackup(await createBackup(src, ctx))
  const before = await ledgerOf(dst)
  const cases: Record<string, string> = {
    'not json': 'hello',
    truncated: text.slice(0, text.length - 40),
    'wrong format': text.replace('splito-backup', 'other'),
    'amount edited': text.replace('"$bigint":"100000"', '"$bigint":"100001"'),
    empty: '',
    array: '[]',
  }
  for (const [name, body] of Object.entries(cases)) {
    let failed = ''
    try {
      parseBackup(body)
    } catch (e) {
      failed = code(e)
    }
    expect(failed, name).toMatch(/^BACKUP_/)
  }
  expect(await ledgerOf(dst)).toEqual(before)
})

test('a file whose money does not add up is rejected even with a valid checksum', async () => {
  await seed()
  const file = await createBackup(src, ctx)
  const e = file.entities.expense!.find(x => (x.data as {title: string}).title === 'Villa')!
  ;(e.data as {total: bigint}).total = 1n
  expect(() => parseBackup(serializeBackup(file))).toThrow(DomainError)
})

test('a file from a newer build is refused, not half-read', async () => {
  const file = await createBackup(src, ctx)
  expect(() => parseBackup(encode({...file, version: BACKUP_VERSION + 1}))).toThrow('BACKUP_TOO_NEW')
  expect(() => parseBackup(encode({...file, entities: {...file.entities, mystery: []}}))).toThrow('BACKUP_TOO_NEW')
})

test('older versions are migrated step by step to the current one', () => {
  const migrations = {
    0: (raw: Record<string, unknown>) => ({...raw, version: 1, renamed: raw.old}),
    1: (raw: Record<string, unknown>) => ({...raw, version: 2, again: true}),
  }
  const out = upgradeBackup({version: 0, old: 'x'}, migrations, 2)
  expect(out).toMatchObject({version: 2, renamed: 'x', again: true})
  expect(() => upgradeBackup({version: 0}, {}, 2)).toThrow('BACKUP_INVALID')
})

test('a failure while applying rolls everything back', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  const before = await ledgerOf(dst)
  const outboxBefore = (await dst.outbox()).length
  let puts = 0
  const flaky: Store = {
    ...dst,
    transaction: fn =>
      dst.transaction(tx =>
        fn({
          ...tx,
          put: async e => {
            if (++puts === 8) throw new Error('disk full')
            await tx.put(e)
          },
        }),
      ),
  }
  await expect(applyBackup(flaky, ctx, file, 'replace')).rejects.toThrow('disk full')
  expect(puts).toBe(8)
  expect(await ledgerOf(dst)).toEqual(before)
  expect((await dst.outbox()).length).toBe(outboxBefore)
})

test('preview counts what a restore would do, without writing', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  const before = await ledgerOf(dst)
  const p = await previewBackup(dst, ctx, file, 'merge')
  expect(p.counts.expense).toMatchObject({add: 3, overwrite: 0, same: 0})
  expect(p.counts.person.add).toBe(2)
  expect(p.counts.person.same).toBe(0)
  expect(p.add).toBeGreaterThan(0)
  expect(p.exportedAt).toBe(file.exportedAt)
  expect(await ledgerOf(dst)).toEqual(before)
})

test('merge adds what is missing, is idempotent and keeps the newer side of a conflict', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  const first = await applyBackup(dst, ctx, file, 'merge')
  expect(first.added).toBeGreaterThan(0)
  const after = await ledgerOf(dst)
  // Applying the same file again changes nothing.
  const again = await applyBackup(dst, ctx, file, 'merge')
  expect(again).toMatchObject({added: 0, overwritten: 0, removed: 0})
  expect(await ledgerOf(dst)).toEqual(after)
  // Edit one expense on the destination afterwards: it is newer than the file, so merge keeps it.
  const villa = (await dst.getAll<{title: string}>('expense')).find(e => e.data.title === 'Villa')!
  await updateExpense(dst, ctx, villa.id, {...(villa.data as unknown as ExpenseDraft), title: 'Villa (edited)'})
  const p = await previewBackup(dst, ctx, file, 'merge')
  expect(p.counts.expense).toMatchObject({add: 0, overwrite: 0, keep: 1})
  await applyBackup(dst, ctx, file, 'merge')
  expect((await dst.get<{title: string}>('expense', villa.id))!.data.title).toBe('Villa (edited)')
  // A file row newer than the device's wins: it lands as a new version, with history.
  const old = await roundTrip({...file, entities: {...file.entities, expense: file.entities.expense!.map(e => (e.id === villa.id ? {...e, updatedAt: clock + 10_000_000, data: {...(e.data as Record<string, unknown>), title: 'Villa (file)'}} : e))}})
  const res = await applyBackup(dst, ctx, old, 'merge')
  expect(res.overwritten).toBe(1)
  const row = await dst.get<{title: string}>('expense', villa.id)
  expect(row!.data.title).toBe('Villa (file)')
  expect((await dst.history('expense', villa.id)).length).toBeGreaterThanOrEqual(3)
})

test('replace makes the device match the file; extra rows are tombstoned, never erased', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  const extra = await createPerson(dst, ctx, {name: 'Only here'})
  await createExpense(dst, ctx, {
    title: 'Local only',
    groupId: null,
    currency: 'INR',
    total: 200n,
    payers: {me: 200n},
    split: {mode: 'equal', participants: ['me', extra.id]},
    date: '2026-10-25',
    tz: 'Asia/Kolkata',
    category: 'food',
    notes: '',
  })
  const p = await previewBackup(dst, ctx, file, 'replace')
  expect(p.remove).toBe(2)
  const res = await applyBackup(dst, ctx, file, 'replace')
  expect(res.removed).toBe(2)
  const gone = await dst.get('person', extra.id)
  expect(gone?.deleted).toBe(true)
  expect((await dst.history('person', extra.id)).length).toBe(2)
  // Me is never removed, and the ledger now matches the file for live rows.
  expect((await dst.get('person', 'me'))?.deleted).toBe(false)
  const live = (await dst.getAll<{title: string}>('expense')).filter(e => !e.deleted).map(e => e.data.title).sort()
  expect(live).toEqual(['Taxi in Dubai', 'Villa'])
})

test('restoring queues the changes in the outbox, except device-only rows', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  await applyBackup(dst, ctx, file, 'replace')
  const ops = (await dst.outbox()).filter(o => o.opType.startsWith('backup.'))
  expect(ops.length).toBeGreaterThan(0)
  expect(ops.some(o => o.entityType === 'expense')).toBe(true)
  // Feedback and device-scoped preferences never leave the device.
  expect(ops.some(o => o.entityType === 'feedback')).toBe(false)
  expect(ops.some(o => o.entityType === 'preference' && o.entityId === 'haptics')).toBe(false)
  expect(ops.some(o => o.entityType === 'preference' && o.entityId === 'defaultCurrency')).toBe(true)
  // Imported rows wait for the server, they are not "synced".
  const e = (await dst.getAll('expense'))[0]!
  expect(e.syncStatus).toBe('pending')
  expect((await dst.get('feedback', (await dst.getAll('feedback'))[0]!.id))!.syncStatus).toBe('local')
})

test('a backup from another identity is remapped onto this device\'s me', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  const other = await openSqlStore(bunExecutor(':memory:'))
  const phone = mk('phone-me')
  await ensureMe(other, phone, 'Me on phone')
  const p = await previewBackup(other, phone, file, 'merge')
  expect(p.foreignIdentity).toBe(true)
  await applyBackup(other, phone, file, 'merge')
  // The old me is not a stranger: the expense Villa is paid by this device's me.
  const villa = (await other.getAll<{title: string; payers: Record<string, bigint>}>('expense')).find(e => e.data.title === 'Villa')!
  expect(Object.keys(villa.data.payers)).toContain('phone-me')
  expect(Object.keys(villa.data.payers)).not.toContain('me')
  expect((await other.getAll<{isMe: boolean}>('person')).filter(x => x.data.isMe).map(x => x.id)).toEqual(['phone-me'])
  const mine = (await other.balances({personId: 'phone-me'})).length
  expect(mine).toBeGreaterThan(0)
})

test('an expense that names a person nobody has is rejected before anything is written', async () => {
  await seed()
  const file = await createBackup(src, ctx)
  const noPeople = await roundTrip({...file, entities: {...file.entities, person: file.entities.person!.filter(p => p.id === 'me')}})
  const before = await ledgerOf(dst)
  await expect(applyBackup(dst, ctx, noPeople, 'merge')).rejects.toThrow('BACKUP_BROKEN_REFERENCE')
  expect(await ledgerOf(dst)).toEqual(before)
})

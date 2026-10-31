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
import {createInviteLink, revokeInviteLink, sendFriendRequest} from '../src/friends'
import {raiseDispute} from '../src/disputes'
import {receiveGroupInvite} from '../src/groupJoins'
import {saveFeedback} from '../src/feedback'
import {createExpense, createGroup, type ExpenseDraft, createPerson, createRepayment, createWriteOffs, deleteExpense, ensureMe, updateExpense} from '../src/mutations'
import {setPref} from '../src/preferences'
import {scheduleReminder} from '../src/reminders'
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
    // An active link is a secret that grants access and stays out of backups; a revoked one is history.
    const link = await createInviteLink(src, ctx, {kind: 'friend', groupId: null, maxUses: 5, expiresInMs: null, approveJoins: false})
    await revokeInviteLink(src, ctx, link.id)
  },
  feedback: async () => {
    await saveFeedback(src, ctx, {type: 'idea', message: 'Please add dark mode', attachment: null, appInfo: null, replyEmail: null})
  },
  preference: async () => {
    await setPref(src, ctx, 'defaultCurrency', 'AED')
  },
  dispute: async () => {
    const [e] = await src.getAll('expense')
    await raiseDispute(src, ctx, {targetType: 'expense', targetId: e!.id, reason: 'wrong_amount', note: 'too high', proposedFix: {kind: 'amount', amount: 900n}})
  },
  groupRequest: async () => {
    await receiveGroupInvite(src, ctx, {id: 'gr1', groupId: 'goa-remote', groupName: 'Goa', groupKind: 'trip', groupCurrency: 'INR', inviter: {accountId: 'acct-riya', name: 'Riya', contact: null}})
  },
  reminder: async () => {
    const asha = (await src.getAll('person')).find(p => p.id !== 'me')!
    await scheduleReminder(src, ctx, {personId: asha.id, groupId: null, dueAt: 1_800_000_000_000, repeat: 'weekly'})
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
  // Feedback never leaves the device.
  expect(ops.some(o => o.entityType === 'feedback')).toBe(false)
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

/** A file edited by hand, with the checksum recomputed as a careful forger would. */
const forged = async (edit: (f: BackupFile) => void) => {
  const f = await createBackup(src, ctx)
  edit(f)
  return roundTrip(f)
}
const person = (id: string, name: string, over: Record<string, unknown> = {}) => ({id, data: {name, isMe: false}, version: 1, deleted: false, createdAt: 1, updatedAt: 1, ...over})
const money = (id: string, data: Record<string, unknown>) => ({id, data: {title: 'x', groupId: null, currency: 'INR', date: '2026-10-20', tz: 'Asia/Kolkata', category: 'food', notes: '', split: {mode: 'equal', participants: []}, ...data}, version: 1, deleted: false, createdAt: 1, updatedAt: 1})

test('a file person row with this device\'s me id is refused: it would overwrite me', async () => {
  const bad = await forged(f => {
    f.entities.person = f.entities.person!.map(p => (p.id === 'me' ? person('me', 'Impostor') : p))
  })
  await expect(applyBackup(dst, ctx, bad, 'merge')).rejects.toThrow('BACKUP_CORRUPT')
  await expect(previewBackup(dst, ctx, bad, 'merge')).rejects.toThrow('BACKUP_CORRUPT')
  expect((await dst.get<{name: string}>('person', 'me'))!.data.name).toBe('Me')
  // From another identity too: a plain person row that carries this device's me id.
  const other = await openSqlStore(bunExecutor(':memory:'))
  const phone = mk('phone-me')
  await ensureMe(other, phone, 'Phone')
  const clash = await forged(f => {
    f.entities.person!.push(person('phone-me', 'Clash'))
  })
  await expect(applyBackup(other, phone, clash, 'merge')).rejects.toThrow('BACKUP_CORRUPT')
})

test('remapping "me" can never fold two people into one: a collision is refused', async () => {
  const other = await openSqlStore(bunExecutor(':memory:'))
  const phone = mk('phone-me')
  await ensureMe(other, phone, 'Phone')
  const bad = await forged(f => {
    f.meId = 'A'
    f.entities.person = [person('A', 'Me', {data: {name: 'Me', isMe: true}})]
    // "phone-me" is a dangling key in the file; A -> phone-me would merge the two shares.
    f.entities.expense = [money('e1', {total: 1000n, payers: {A: 1000n}, shares: {A: 500n, 'phone-me': 500n}})]
    f.history = []
  })
  await expect(applyBackup(other, phone, bad, 'merge')).rejects.toThrow('BACKUP_CORRUPT')
  expect((await other.getAll('expense')).length).toBe(0)
})

test('a tombstoned person or group does not satisfy a reference', async () => {
  const gone = await forged(f => {
    f.entities.person!.push(person('p-dead', 'Dead', {deleted: true}))
    f.entities.expense!.push(money('e-dead-ref', {total: 100n, payers: {me: 100n}, shares: {me: 50n, 'p-dead': 50n}}))
  })
  await expect(applyBackup(dst, ctx, gone, 'merge')).rejects.toThrow('BACKUP_BROKEN_REFERENCE')
  // The device's own tombstone is no better.
  await seed()
  const ben = (await src.getAll('person')).find(p => (p.data as {name: string}).name === 'Ben')!
  const file = await roundTrip(await createBackup(src, ctx))
  await applyBackup(dst, ctx, file, 'merge')
  await dst.transaction(async tx => {
    const e = (await tx.get<Record<string, unknown>>('person', ben.id))!
    await tx.put({type: 'person', id: ben.id, data: e.data, version: e.version + 1, deleted: true, updatedAt: clock++})
  })
  const ref = await forged(f => {
    f.entities.person = f.entities.person!.filter(p => p.id !== ben.id)
    f.entities.expense = [money('e-new', {total: 100n, payers: {me: 100n}, shares: {me: 50n, [ben.id]: 50n}})]
    f.entities.group = []
    f.entities.repayment = []
    f.entities.writeoff = []
    f.history = []
  })
  await expect(applyBackup(dst, ctx, ref, 'merge')).rejects.toThrow('BACKUP_BROKEN_REFERENCE')
})

test('a restore adds no expense to an inactive group, but a payment may still land', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  await applyBackup(dst, ctx, file, 'merge')
  const g = (await dst.getAll<Record<string, unknown>>('group'))[0]!
  await dst.transaction(async tx => {
    await tx.put({type: 'group', id: g.id, data: {...g.data, archived: true}, version: g.version + 1, deleted: false, updatedAt: clock++})
  })
  const asha = (await dst.getAll<{name: string}>('person')).find(p => p.data.name === 'Asha')!
  const extra = await forged(f => {
    f.entities.expense!.push(money('e-in-archived', {total: 100n, groupId: g.id, payers: {me: 100n}, shares: {me: 50n, [asha.id]: 50n}}))
  })
  await expect(applyBackup(dst, ctx, extra, 'merge')).rejects.toThrow('GROUP_INACTIVE')
  await expect(previewBackup(dst, ctx, extra, 'merge')).rejects.toThrow('GROUP_INACTIVE')
  const pay = await forged(f => {
    f.entities.repayment!.push({id: 'r-in-archived', data: {groupId: g.id, currency: 'INR', from: asha.id, to: 'me', amount: 10n, date: '2026-10-25', tz: 'Asia/Kolkata', note: ''}, version: 1, deleted: false, createdAt: 1, updatedAt: 1})
  })
  const res = await applyBackup(dst, ctx, pay, 'merge')
  expect(res.added).toBe(1)
  // A group that arrives archived together with its own history is not "adding to an inactive group".
  const fresh = await openSqlStore(bunExecutor(':memory:'))
  await ensureMe(fresh, ctx, 'Me')
  const archived = await forged(f => {
    f.entities.group = f.entities.group!.map(x => ({...x, data: {...(x.data as object), archived: true}}))
  })
  await applyBackup(fresh, ctx, archived, 'merge')
  expect((await fresh.getAll('expense')).length).toBe(3)
})

test('the file header is in the checksum, and a lower schema is refused until migrations exist', async () => {
  await seed()
  const file = await createBackup(src, ctx)
  const text = serializeBackup(file)
  const raw = JSON.parse(text)
  expect(() => parseBackup(JSON.stringify({...raw, meId: 'someone-else'}))).toThrow('BACKUP_CORRUPT')
  expect(() => parseBackup(JSON.stringify({...raw, exportedAt: raw.exportedAt + 1}))).toThrow('BACKUP_CORRUPT')
  const { schemaVersion: _s, ...noSchema } = raw
  expect(() => parseBackup(JSON.stringify(noSchema))).toThrow('BACKUP_INVALID')
  expect(() => parseBackup(serializeBackup({...file, schemaVersion: file.schemaVersion - 1}))).toThrow('BACKUP_TOO_OLD')
})

test('device-scoped preferences and active invite links stay out of a backup', async () => {
  await setPref(src, ctx, 'haptics', false)
  await setPref(src, ctx, 'defaultCurrency', 'AED')
  await createInviteLink(src, ctx, {kind: 'friend', groupId: null, maxUses: 5, expiresInMs: null, approveJoins: false})
  const file = await createBackup(src, ctx)
  expect(file.entities.preference!.map(p => p.id)).toEqual(['defaultCurrency'])
  expect(file.entities.inviteLink).toEqual([])
  // And a hand-made file that carries them is not applied.
  const carried = await forged(f => {
    f.entities.preference!.push({id: 'haptics', data: {value: false}, version: 1, deleted: false, createdAt: 1, updatedAt: 1})
  })
  await applyBackup(dst, ctx, carried, 'merge')
  expect(await dst.get('preference', 'haptics')).toBeUndefined()
})

test('replace leaves rows that never travel in a file alone, and re-applying the pre-restore backup undoes it', async () => {
  await seed()
  const file = await roundTrip(await createBackup(src, ctx))
  // The device has its own device-scoped preference and a live invite link: neither is in any file.
  await setPref(dst, ctx, 'haptics', false)
  const live = await createInviteLink(dst, ctx, {kind: 'friend', groupId: null, maxUses: 1, expiresInMs: null, approveJoins: false})
  const mine = await createPerson(dst, ctx, {name: 'Only here'})
  const before = await createBackup(dst, ctx)
  const res = await applyBackup(dst, ctx, file, 'replace')
  expect(res.removed).toBe(1) // only the person: not the pref, not the link
  expect((await dst.get<{value: boolean}>('preference', 'haptics'))!.deleted).toBe(false)
  expect((await dst.get('inviteLink', live.id))!.deleted).toBe(false)
  expect((await dst.get('person', mine.id))!.deleted).toBe(true)
  // Undo: the in-memory backup taken just before puts everything back.
  await applyBackup(dst, ctx, before, 'replace')
  expect((await dst.get('person', mine.id))!.deleted).toBe(false)
  expect((await dst.getAll('expense')).filter(e => !e.deleted)).toEqual([])
})

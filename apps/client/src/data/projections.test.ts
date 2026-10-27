import 'fake-indexeddb/auto'

import {expect, test} from 'bun:test'
import {
  createPerson,
  type Entity,
  ensureMe,
  type MutationCtx,
  openIdbStore,
  setPref,
  type Store,
} from '@splito/sync'
import {IDBFactory} from 'fake-indexeddb'

import {
  activityQuery,
  entitiesQuery,
  projectionFor,
  type Query,
  shareRows,
} from './projections'

let n = 0
const ctx: MutationCtx = {deviceId: 'd', actor: 'me', now: () => ++n, newId: () => `id${++n}`}

async function openStore() {
  const store = await openIdbStore(`p${++n}`, new IDBFactory())
  await ensureMe(store, ctx, 'Me')
  return store
}

/** Counts store reads by type. */
function countReads(store: Store) {
  const reads: Record<string, number> = {}
  const getAll = store.getAll.bind(store)
  store.getAll = (type => {
    reads[type] = (reads[type] ?? 0) + 1
    return getAll(type)
  }) as Store['getAll']
  return reads
}

/** Resolves once the projection reports `count` changes. */
function changes<T>(store: Store, query: Query<T>) {
  const p = projectionFor(store, query)
  let seen = 0
  const waiters: Array<[number, () => void]> = []
  const off = p.subscribe(() => {
    seen++
    for (const [want, resolve] of waiters) if (seen >= want) resolve()
  })
  const until = (count: number) =>
    new Promise<void>((resolve, reject) => {
      if (seen >= count) return resolve()
      waiters.push([count, resolve])
      setTimeout(() => reject(new Error(`only ${seen} of ${count} changes`)), 2000)
    })
  return {p, off, until, seen: () => seen}
}

const settle = () => new Promise(r => setTimeout(r, 50))

test('shareRows keeps unchanged rows and the array itself when nothing changed', () => {
  const row = (id: string, version = 1): Entity => ({type: 'person', id, data: {}, version, deleted: false, createdAt: 1, updatedAt: version, syncStatus: 'local', serverVersion: null, syncedAt: null, syncError: null})
  const prev = [row('a'), row('b')]
  expect(shareRows(prev, [row('a'), row('b')])).toBe(prev)
  const next = shareRows(prev, [row('a'), row('b', 2)])
  expect(next).not.toBe(prev)
  expect(next[0]).toBe(prev[0]!)
  expect(next[1]).not.toBe(prev[1]!)
  expect(shareRows(prev, [row('a')])).toEqual([prev[0]!])
  expect(shareRows(undefined, prev)).toBe(prev)
})

test('subscribers share one load; only commits that touch the type re-read it', async () => {
  const store = await openStore()
  const reads = countReads(store)
  const a = changes(store, entitiesQuery('person'))
  const b = projectionFor(store, entitiesQuery('person'))
  expect(b).toBe(a.p)
  const offB = b.subscribe(() => {})
  await a.until(1)
  expect(reads.person).toBe(1)
  const first = a.p.get()!
  expect(first.map(p => p.id)).toEqual(['me'])

  await setPref(store, ctx, 'accent', '#7c3aed')
  await settle()
  expect(reads.person).toBe(1)
  expect(a.p.get()).toBe(first)

  await createPerson(store, ctx, {name: 'Riya'})
  await a.until(2)
  expect(reads.person).toBe(2)
  expect(a.p.get()!).toHaveLength(2)
  // The unchanged row keeps its object.
  expect(a.p.get()![0] === first[0] || a.p.get()![1] === first[0]).toBe(true)

  a.off()
  offB()
  // Idle: no value, no store subscription.
  expect(a.p.get()).toBeUndefined()
  await createPerson(store, ctx, {name: 'Sam'})
  await settle()
  expect(reads.person).toBe(2)
})

test('a burst of commits is coalesced into few re-reads, ending current', async () => {
  const store = await openStore()
  const reads = countReads(store)
  const a = changes(store, entitiesQuery('person'))
  await a.until(1)
  await Promise.all(Array.from({length: 10}, (_, i) => createPerson(store, ctx, {name: `P${i}`})))
  await settle()
  await settle()
  expect(a.p.get()!).toHaveLength(11)
  expect(reads.person!).toBeLessThan(11)
  a.off()
})

test('the activity projection skips preference commits', async () => {
  const store = await openStore()
  const reads = countReads(store)
  const a = changes(store, activityQuery)
  await a.until(1)
  const before = {...reads}
  await setPref(store, ctx, 'accent', '#7c3aed')
  await settle()
  expect(reads).toEqual(before)
  await createPerson(store, ctx, {name: 'Riya'})
  await a.until(2)
  expect(a.p.get()!.events.some(e => e.kind === 'person.added')).toBe(true)
  a.off()
})

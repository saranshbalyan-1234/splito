import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {expect, test} from 'bun:test'

import {openIdbStore} from '../src/idbStore'
import {changeFromJson, changeToJson, mergeChanges, type StoreChange, touches} from '../src/store'
import {ent, op, runStoreContract} from './storeContract'
import {runV2Contract} from './storeV2Contract'

let factory = new IDBFactory()
runStoreContract(
  'IdbStore',
  () => {
    factory = new IDBFactory()
    return openIdbStore('splito', factory)
  },
  () => openIdbStore('splito', factory),
)

runV2Contract('IdbStore', () => openIdbStore('splito-v2', new IDBFactory()))

test('another tab hears what a transaction touched; an old-build notice reads as unknown', async () => {
  const f = new IDBFactory()
  const a = await openIdbStore('tabs', f)
  const b = await openIdbStore('tabs', f)
  const heard = new Promise<StoreChange>(resolve => b.subscribe(resolve))
  await a.transaction(async tx => tx.put(ent('expense', 'e1')))
  const change = await heard
  expect(touches(change, 'expense', 'e1')).toBe(true)
  expect(touches(change, 'preference')).toBe(false)
  expect(changeFromJson('changed')).toBe('unknown')
  expect(changeFromJson({expense: [1]})).toBe('unknown')
  expect(touches(changeFromJson(changeToJson({person: new Set(['p'])})), 'person', 'p')).toBe(true)
  await a.close()
  await b.close()
})

test('mergeChanges: the union of two notices; unknown wins', () => {
  const m = mergeChanges({expense: new Set(['e1'])}, {expense: new Set(['e2']), person: new Set(['p'])})
  expect(touches(m, 'expense', 'e1') && touches(m, 'expense', 'e2') && touches(m, 'person', 'p')).toBe(true)
  expect(touches(m, 'group')).toBe(false)
  expect(mergeChanges('unknown', {})).toBe('unknown')
  expect(mergeChanges({}, 'unknown')).toBe('unknown')
})

test('a pipelined write that fails mid-transaction rolls everything back and surfaces its own error, not a later one', async () => {
  const s = await openIdbStore('pipelined-failure', new IDBFactory())
  await s.transaction(async tx => {
    await tx.put(ent('person', 'p1'))
    await tx.enqueue(op('dup'))
  })
  const error = await s
    .transaction(async tx => {
      await tx.put(ent('person', 'p2'))
      // The duplicate op id fails asynchronously (the add is not awaited) ...
      await tx.enqueue({...op('dup'), entityId: 'p2'})
      // ... and the transaction aborts under the reads that follow.
      await tx.get('person', 'p2')
      await tx.get('person', 'p1')
    })
    .then(
      () => undefined,
      (e: unknown) => e,
    )
  expect((error as Error | undefined)?.name).toBe('ConstraintError')
  expect((await s.getAll('person')).map(e => e.id)).toEqual(['p1'])
  expect(await s.outbox()).toHaveLength(1)
  await s.close()
})

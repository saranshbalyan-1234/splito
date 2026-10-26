import {describe, expect, test} from 'bun:test'

import {type Store, type StoreChange, touches} from '../src/store'
import type {Entity, OutboxOp} from '../src/types'

export const ent = (type: Entity['type'], id: string, data: unknown = {n: 1n}): Entity => ({type, id, data, version: 1, deleted: false, updatedAt: 1})
export const op = (opId: string): OutboxOp => ({
  opId,
  deviceId: 'd',
  actor: 'me',
  entityType: 'person',
  entityId: 'p1',
  opType: 'person.create',
  baseVersion: 0,
  payload: {amount: 5n},
  schemaVersion: 1,
  deps: [],
  attempts: 0,
  nextAttemptAt: null,
  lastError: null,
})

/** Behaviour every Store implementation must share. `open` gives a fresh empty store; `reopen` reopens the same one. */
export function runStoreContract(name: string, open: () => Promise<Store>, reopen: () => Promise<Store>) {
  describe(name, () => {
    test('put/get/getAll round-trip with bigint data', async () => {
      const s = await open()
      await s.transaction(async tx => {
        await tx.put(ent('person', 'p1', {big: 10n ** 14n}))
        expect((await tx.get('person', 'p1'))?.data).toEqual({big: 10n ** 14n})
      })
      expect(await s.getAll('person')).toEqual([ent('person', 'p1', {big: 10n ** 14n})])
      expect(await s.getAll('group')).toEqual([])
      await s.close()
    })

    test('put overwrites same type+id', async () => {
      const s = await open()
      await s.transaction(async tx => {
        await tx.put(ent('person', 'p1'))
        await tx.put({...ent('person', 'p1'), version: 2, deleted: true})
      })
      expect(await s.getAll('person')).toEqual([{...ent('person', 'p1'), version: 2, deleted: true}])
      await s.close()
    })

    test('rollsBackOnThrow', async () => {
      const s = await open()
      await expect(
        s.transaction(async tx => {
          await tx.put(ent('person', 'p1'))
          await tx.enqueue(op('o1'))
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')
      expect(await s.getAll('person')).toEqual([])
      expect(await s.outbox()).toEqual([])
      await s.close()
    })

    test('survivesReopen', async () => {
      const s = await open()
      await s.transaction(async tx => {
        await tx.put(ent('person', 'p1'))
        await tx.appendHistory({entityType: 'person', entityId: 'p1', version: 1, data: {n: 1n}, deleted: false, at: 1, actor: 'me'})
        await tx.enqueue(op('o1'))
      })
      await s.transaction(async tx => tx.enqueue(op('o2')))
      await s.close()
      const s2 = await reopen()
      expect((await s2.getAll('person')).map(e => e.id)).toEqual(['p1'])
      const ops = await s2.outbox()
      expect(ops.map(o => o.opId)).toEqual(['o1', 'o2'])
      expect(ops[0]!.seq! < ops[1]!.seq!).toBe(true)
      expect(ops[0]!.payload).toEqual({amount: 5n})
      expect(await s2.history('person', 'p1')).toHaveLength(1)
      await s2.close()
    })

    test('duplicate opId rejected and rolls back the transaction', async () => {
      const s = await open()
      await s.transaction(async tx => tx.enqueue(op('o1')))
      await expect(
        s.transaction(async tx => {
          await tx.put(ent('person', 'p9'))
          await tx.enqueue(op('o1'))
        }),
      ).rejects.toThrow()
      expect(await s.getAll('person')).toEqual([])
      expect((await s.outbox()).map(o => o.opId)).toEqual(['o1'])
      await s.close()
    })

    test('subscribe fires once per committed transaction, not on rollback', async () => {
      const s = await open()
      let calls = 0
      const off = s.subscribe(() => calls++)
      await s.transaction(async tx => {
        await tx.put(ent('person', 'a'))
        await tx.put(ent('person', 'b'))
      })
      await s.transaction(async () => {
        throw new Error('x')
      }).catch(() => {})
      expect(calls).toBe(1)
      off()
      await s.transaction(async tx => tx.put(ent('person', 'c')))
      expect(calls).toBe(1)
      await s.close()
    })

    test('the change notice names the entity types and ids the transaction touched', async () => {
      const s = await open()
      const changes: StoreChange[] = []
      const off = s.subscribe(c => changes.push(c))
      await s.transaction(async tx => {
        await tx.put(ent('expense', 'e1'))
        await tx.appendHistory({entityType: 'expense', entityId: 'e1', version: 1, data: {}, deleted: false, at: 1, actor: 'me'})
        await tx.put(ent('person', 'p1'))
      })
      await s.transaction(async tx => tx.put(ent('preference', 'theme')))
      // A transaction that writes no entity (only the outbox) still notifies, touching nothing.
      await s.transaction(async tx => tx.enqueue(op('o9')))
      off()
      expect(changes).toHaveLength(3)
      const [first, second, third] = changes
      expect(touches(first!, 'expense', 'e1')).toBe(true)
      expect(touches(first!, 'person')).toBe(true)
      expect(touches(first!, 'expense', 'e2')).toBe(false)
      expect(touches(first!, 'preference')).toBe(false)
      expect(touches(second!, 'preference', 'theme')).toBe(true)
      expect(touches(second!, 'expense')).toBe(false)
      expect(touches(third!, 'expense')).toBe(false)
      await s.close()
    })

    test('history ordered by version', async () => {
      const s = await open()
      await s.transaction(async tx => {
        for (const v of [2, 1, 3])
          await tx.appendHistory({entityType: 'expense', entityId: 'e', version: v, data: {v}, deleted: false, at: v, actor: 'me'})
      })
      expect((await s.history('expense', 'e')).map(h => h.version)).toEqual([1, 2, 3])
      await s.close()
    })

    test('erase removes exactly the named entities with their history and outbox ops', async () => {
      const s = await open()
      await s.transaction(async tx => {
        for (const id of ['p1', 'p2']) {
          await tx.put(ent('person', id))
          await tx.appendHistory({entityType: 'person', entityId: id, version: 1, data: {}, deleted: false, at: 1, actor: 'me'})
          await tx.enqueue({...op(`op-${id}`), entityId: id})
        }
      })
      const seen: unknown[] = []
      s.subscribe(c => seen.push(c))
      await s.erase([{type: 'person', id: 'p1'}])
      expect((await s.getAll('person')).map(e => e.id)).toEqual(['p2'])
      expect(await s.history('person', 'p1')).toEqual([])
      expect(await s.history('person', 'p2')).toHaveLength(1)
      expect((await s.outbox()).map(o => o.opId)).toEqual(['op-p2'])
      expect(touches(seen[0] as StoreChange, 'person', 'p1')).toBe(true)
      await s.close()
    })
  })
}

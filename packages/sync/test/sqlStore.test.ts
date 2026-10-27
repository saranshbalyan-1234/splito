import {describe, expect, test} from 'bun:test'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {openSqlStore} from '../src/sqlStore'
import {bunExecutor} from './bunExecutor'
import {ent, op, runStoreContract} from './storeContract'
import {runV2Contract} from './storeV2Contract'

let path = ''
runStoreContract(
  'SqlStore',
  () => {
    path = join(mkdtempSync(join(tmpdir(), 'splito-')), 'db.sqlite')
    return openSqlStore(bunExecutor(path))
  },
  () => openSqlStore(bunExecutor(path)),
)

const fresh = () => openSqlStore(bunExecutor(join(mkdtempSync(join(tmpdir(), 'splito-')), 'db.sqlite')))
runV2Contract('SqlStore', fresh)
const tick = () => new Promise(r => setTimeout(r, 1))

/*
 * expo-sqlite sends a plain BEGIN/COMMIT on one shared connection, so two
 * mutations in flight at once (a double tap, Undo during a save) must queue:
 * a second BEGIN would fail and its ROLLBACK would undo the first one.
 */
describe('SqlStore concurrency', () => {
  test('overlapping transactions both commit whole; one failing does not undo the other', async () => {
    const s = await fresh()
    const write = (id: string, isFailing = false) =>
      s.transaction(async tx => {
        await tx.put(ent('person', id))
        await tick()
        await tx.enqueue(op('op-' + id))
        if (isFailing) throw new Error('boom')
      })
    const results = await Promise.allSettled([write('p1'), write('p2', true), write('p3')])
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
    expect((await s.getAll('person')).map(e => e.id)).toEqual(['p1', 'p3'])
    expect((await s.outbox()).map(o => o.opId)).toEqual(['op-p1', 'op-p3'])
    await s.close()
  })

  test('reads wait for a transaction in flight instead of seeing its uncommitted writes', async () => {
    const s = await fresh()
    const failing = s
      .transaction(async tx => {
        await tx.put(ent('person', 'ghost'))
        await tick()
        throw new Error('boom')
      })
      .catch(() => undefined)
    const seen = await s.getAll('person')
    await failing
    expect(seen).toEqual([])
    await s.close()
  })
})

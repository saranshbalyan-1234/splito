import {describe, expect, test} from 'bun:test'

import {createSqlExecutor, YIELD_EVERY} from './sqliteExecutor'

/** A db double that records which API each statement went through. */
function fakeDb() {
  const calls: string[] = []
  let prepares = 0
  let finalized = 0
  const db = {
    execAsync: async (sql: string) => void calls.push(`execAsync ${sql}`),
    runAsync: async (sql: string) => void calls.push(`runAsync ${sql}`),
    getAllAsync: async (sql: string) => (calls.push(`getAllAsync ${sql}`), [{via: 'async'}]),
    closeAsync: async () => void calls.push('closeAsync'),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      calls.push('BEGIN')
      await fn()
      calls.push('COMMIT')
    },
    prepareSync: (sql: string) => {
      prepares++
      return {
        executeSync: (params: unknown[]) => {
          calls.push(`executeSync ${sql} ${JSON.stringify(params)}`)
          return {resetSync: () => void calls.push('resetSync'), getAllSync: () => [{via: 'sync'}]}
        },
        finalizeSync: () => void finalized++,
      }
    },
  }
  return {db: db as never, calls, prepares: () => prepares, finalized: () => finalized}
}

describe('createSqlExecutor', () => {
  test('outside a transaction every statement is async', async () => {
    const f = fakeDb()
    const exec = createSqlExecutor(f.db)
    await exec.run('INSERT a', [1])
    expect(await exec.all('SELECT a', [])).toEqual([{via: 'async'}])
    expect(f.calls).toEqual(['runAsync INSERT a', 'getAllAsync SELECT a'])
    expect(f.prepares()).toBe(0)
  })

  test('inside a transaction statements run sync and prepared once per SQL string', async () => {
    const f = fakeDb()
    const exec = createSqlExecutor(f.db)
    await exec.withTransaction(async () => {
      await exec.run('INSERT a', [1])
      await exec.run('INSERT a', [2])
      expect(await exec.all('SELECT a', [])).toEqual([{via: 'sync'}])
      await exec.run('INSERT b', [3])
    })
    expect(f.calls.filter(c => c.startsWith('runAsync') || c.startsWith('getAllAsync'))).toEqual([])
    expect(f.calls.filter(c => c.startsWith('executeSync')).length).toBe(4)
    expect(f.prepares()).toBe(3) // INSERT a (reused), SELECT a, INSERT b
    expect(f.calls[0]).toBe('BEGIN')
    expect(f.calls.at(-1)).toBe('COMMIT')
    // Back outside: async again.
    await exec.run('INSERT c', [])
    expect(f.calls.at(-1)).toBe('runAsync INSERT c')
  })

  test('the flag clears when the transaction throws', async () => {
    const f = fakeDb()
    const exec = createSqlExecutor(f.db)
    const failing = exec.withTransaction(async () => {
      await exec.run('INSERT a', [])
      throw new Error('boom')
    })
    await expect(failing).rejects.toThrow('boom')
    await exec.run('INSERT b', [])
    expect(f.calls.at(-1)).toBe('runAsync INSERT b')
  })

  test('a long transaction yields every YIELD_EVERY statements and stays one transaction', async () => {
    const f = fakeDb()
    let yields = 0
    const exec = createSqlExecutor(f.db, async () => void yields++)
    await exec.withTransaction(async () => {
      for (let i = 0; i < YIELD_EVERY * 3 + 7; i++) await exec.run('INSERT a', [i])
    })
    expect(yields).toBe(3)
    expect(f.calls.filter(c => c === 'BEGIN' || c === 'COMMIT')).toEqual(['BEGIN', 'COMMIT'])
  })

  test('close finalizes every prepared statement and closes the connection', async () => {
    const f = fakeDb()
    const exec = createSqlExecutor(f.db)
    await exec.withTransaction(async () => {
      await exec.run('INSERT a', [])
      await exec.run('INSERT b', [])
    })
    await exec.close()
    expect(f.finalized()).toBe(2)
    expect(f.calls.at(-1)).toBe('closeAsync')
  })
})

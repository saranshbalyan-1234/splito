import {type SqlExecutor} from '@splito/sync'

/* The slice of expo-sqlite's connection this uses, typed here so only data/store.ts imports the library (§ 1). */
type Statement = {
  executeSync(params: never[]): {resetSync(): void; getAllSync(): unknown[]}
  finalizeSync(): void
}
export type Connection = {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, params: never[]): Promise<unknown>
  getAllAsync(sql: string, params: never[]): Promise<unknown[]>
  withTransactionAsync(fn: () => Promise<void>): Promise<void>
  closeAsync(): Promise<void>
  prepareSync(sql: string): Statement
}

/** Statements a transaction runs before it lets the JS thread breathe (touches, timers, a frame). */
export const YIELD_EVERY = 500

const yieldToJs = () => new Promise<void>(resolve => setTimeout(resolve, 0))

/**
 * The SQL executor over an open expo-sqlite connection (`data/store.ts` opens it).
 *
 * Inside a transaction the statements run through expo-sqlite's synchronous API: every async call is a hop to
 * the native queue and back (~0.14 ms), and seeding the demo set is ~38,000 statements, 5.5 s of hops against
 * ~1.4 s on web. The connection is the transaction's own (`openSqlStore` queues every transaction and read, so
 * nothing else touches it meanwhile) and each statement is a small row write. The JS thread is released every
 * `YIELD_EVERY` statements, so a bulk transaction is many short tasks, not one long one; the transaction itself
 * (BEGIN .. COMMIT, atomic) is unchanged. Outside one, reads and writes stay async (a long page read must not
 * block). The statements are a small fixed set (one per store and operation): prepared once, then rebound.
 */
export function createSqlExecutor(
  db: Connection,
  yieldNow: () => Promise<void> = yieldToJs,
): SqlExecutor {
  let isInTransaction = false
  let sinceYield = 0
  const prepared = new Map<string, Statement>()
  const statement = (sql: string) => {
    let st = prepared.get(sql)
    if (!st) prepared.set(sql, (st = db.prepareSync(sql)))
    return st
  }
  const breathe = async () => {
    if (++sinceYield >= YIELD_EVERY) {
      sinceYield = 0
      await yieldNow()
    }
  }
  return {
    exec: sql => db.execAsync(sql),
    run: async (sql, params) => {
      if (isInTransaction) {
        statement(sql).executeSync(params as never[]).resetSync()
        await breathe()
      } else await db.runAsync(sql, params as never[])
    },
    all: async <R,>(sql: string, params: unknown[]) => {
      if (!isInTransaction) return (await db.getAllAsync(sql, params as never[])) as R[]
      const result = statement(sql).executeSync(params as never[])
      let rows: unknown[]
      try {
        rows = result.getAllSync()
      } finally {
        result.resetSync()
      }
      await breathe()
      return rows as R[]
    },
    // Plain BEGIN/COMMIT on the shared connection; openSqlStore queues transactions and reads so they never overlap.
    withTransaction: async fn => {
      let result!: Awaited<ReturnType<typeof fn>>
      await db.withTransactionAsync(async () => {
        isInTransaction = true
        sinceYield = 0
        try {
          result = await fn()
        } finally {
          isInTransaction = false
        }
      })
      return result
    },
    close: async () => {
      for (const st of prepared.values()) st.finalizeSync()
      prepared.clear()
      await db.closeAsync()
    },
  }
}

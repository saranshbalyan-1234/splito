import {Database} from 'bun:sqlite'

import type {SqlExecutor} from '../src/sqlStore'

/**
 * A SQLite executor over bun:sqlite. Pass a path (`':memory:'`) to open a database that `close()` closes, or an open
 * `Database` to share one (a test that reopens "the same file"): `close()` then leaves it open for the caller.
 */
export function bunExecutor(source: string | Database): SqlExecutor {
  const db = typeof source === 'string' ? new Database(source) : source
  return {
    async exec(sql) {
      db.run(sql)
    },
    async run(sql, params) {
      db.query(sql).run(...(params as never[]))
    },
    async all(sql, params) {
      return db.query(sql).all(...(params as never[])) as never
    },
    async withTransaction(fn) {
      db.run('BEGIN IMMEDIATE')
      try {
        const r = await fn()
        db.run('COMMIT')
        return r
      } catch (e) {
        db.run('ROLLBACK')
        throw e
      }
    },
    async close() {
      if (typeof source === 'string') db.close()
    },
  }
}

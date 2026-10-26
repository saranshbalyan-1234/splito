import {Database} from 'bun:sqlite'

import type {SqlExecutor} from '../src/sqlStore'

export function bunExecutor(path: string): SqlExecutor {
  const db = new Database(path)
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
      db.close()
    },
  }
}

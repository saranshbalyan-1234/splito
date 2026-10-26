import {SQL} from 'bun'

import {migrate} from '../src/migrate'

/** Admin connection used to create and drop a throwaway database per test file. */
export const ADMIN_URL =
  Bun.env.TEST_DATABASE_URL ??
  'postgres://postgres:splito@localhost:55432/postgres'

/** A freshly created, migrated database; `drop()` removes it. */
export async function freshDb() {
  const admin = new SQL(ADMIN_URL)
  const name = `splito_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`
  await admin.unsafe(`CREATE DATABASE ${name}`)
  const url = new URL(ADMIN_URL)
  url.pathname = `/${name}`
  const sql = new SQL(url.toString())
  await migrate(sql)
  return {
    sql,
    url: url.toString(),
    async drop() {
      await sql.close()
      await admin.unsafe(`DROP DATABASE ${name} WITH (FORCE)`)
      await admin.close()
    },
  }
}

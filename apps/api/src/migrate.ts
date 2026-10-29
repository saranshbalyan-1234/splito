import {readdir} from 'node:fs/promises'
import {join} from 'node:path'

import {SQL} from 'bun'

const MIGRATIONS_DIR = join(import.meta.dir, '../migrations')

/**
 * Applies pending migrations/*.sql in name order. Each file runs in its own
 * transaction together with its schema_migrations row, under an advisory lock,
 * so a failed file leaves nothing behind and concurrent boots apply it once.
 * Returns the names applied by this call.
 */
export async function migrate(
  sql: SQL,
  dir = MIGRATIONS_DIR,
): Promise<string[]> {
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()
  const applied: string[] = []
  for (const name of files) {
    const text = await Bun.file(join(dir, name)).text()
    const isApplied = await sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended('splito:migrate', 0))`
      await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
      if (
        (await tx`SELECT 1 FROM schema_migrations WHERE name = ${name}`).length
      )
        return false
      await tx.unsafe(text)
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`
      return true
    })
    if (isApplied) applied.push(name)
  }
  return applied
}

if (import.meta.main) {
  const sql = new SQL(Bun.env.DATABASE_URL ?? '')
  console.log('applied', await migrate(sql))
  await sql.close()
}

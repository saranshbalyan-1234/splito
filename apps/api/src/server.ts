import {SQL} from 'bun'

import {buildApp} from './app'
import {migrate} from './migrate'

if (!Bun.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required (see .env.example)')

const sql = new SQL(Bun.env.DATABASE_URL, {
  max: Number(Bun.env.DB_POOL_MAX ?? 10),
})
await migrate(sql)
const app = buildApp({sql, nodeEnv: Bun.env.NODE_ENV})
await app.listen({
  host: Bun.env.HOST ?? '0.0.0.0',
  port: Number(Bun.env.PORT ?? 3000),
})

/* Graceful shutdown: stop accepting, let in-flight requests finish, then close the pool. Hard exit after 10 s. */
async function shutdown(signal: string) {
  app.log.info({signal}, 'shutting down')
  setTimeout(() => process.exit(1), 10_000).unref()
  await app.close()
  await sql.close()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

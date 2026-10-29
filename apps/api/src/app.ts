import {
  DEFAULT_PULL_LIMIT,
  ERRORS,
  PullRequest,
  PushRequest,
  SnapshotRequest,
} from '@splito/contracts'
import type {SQL} from 'bun'
import Fastify, {type FastifyRequest} from 'fastify'

import {ApiError, envelope} from './errors'
import {pull, push, snapshot} from './sync'

declare module 'fastify' {
  interface FastifyRequest {
    accountId: string
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Log paths that are always censored: op payloads, bodies, stored acks and credentials. */
export const LOG_REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'body',
  'payload',
  'data',
  'ack',
  '*.body',
  '*.payload',
  '*.data',
  '*.ack',
]

/**
 * The only place a request becomes an account. Real auth is not implemented:
 * only NODE_ENV=development or test accept the x-splito-dev-account header
 * (a uuid, auto-provisioned); everything else is UNAUTHENTICATED.
 */
export async function resolveAccount(
  req: FastifyRequest,
  nodeEnv: string | undefined,
  sql: SQL,
): Promise<string> {
  const dev = req.headers['x-splito-dev-account']
  if (
    (nodeEnv === 'development' || nodeEnv === 'test') &&
    typeof dev === 'string' &&
    UUID.test(dev)
  ) {
    const id = dev.toLowerCase()
    await sql`INSERT INTO accounts (id) VALUES (${id}) ON CONFLICT DO NOTHING`
    return id
  }
  throw new ApiError('UNAUTHENTICATED', 'Authentication required')
}

/** The HTTP app. The caller owns `sql` and closes it after `app.close()`. */
export function buildApp({
  sql,
  nodeEnv,
  logger = true,
}: {
  sql: SQL
  /** NODE_ENV, passed explicitly so unset means unset. */
  nodeEnv: string | undefined
  logger?: boolean | {stream: NodeJS.WritableStream}
}) {
  const app = Fastify({
    logger: logger && {
      level: Bun.env.LOG_LEVEL ?? 'info',
      redact: {paths: LOG_REDACT, censor: '[redacted]'},
      ...(logger === true ? {} : logger),
    },
    // The wire contract is exact: "1" is not an integer.
    ajv: {customOptions: {coerceTypes: false}},
  })
  app.decorateRequest('accountId', '')

  app.setErrorHandler(
    (
      err: {
        validation?: Array<{instancePath: string; message?: string}>
        statusCode?: number
        message: string
      },
      req,
      reply,
    ) => {
      if (err instanceof ApiError)
        return reply
          .code(ERRORS[err.code].status)
          .send(envelope(err.code, err.message, err.details))
      if (err.validation) {
        const details = err.validation.map(v => ({
          path: v.instancePath,
          message: v.message,
        }))
        return reply
          .code(400)
          .send(envelope('VALIDATION', err.message, details))
      }
      // Fastify's own 4xx (malformed JSON, body too large, wrong content type).
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500)
        return reply
          .code(err.statusCode)
          .send(envelope('VALIDATION', err.message))
      req.log.error({err}, 'request failed')
      return reply.code(500).send(envelope('INTERNAL', 'Internal error'))
    },
  )

  app.get('/healthz', async () => ({ok: true}))
  app.get('/readyz', async (req, reply) => {
    try {
      await sql`SELECT 1`
      return {ok: true}
    } catch (err) {
      req.log.warn({err}, 'readiness check failed')
      return reply.code(503).send(envelope('INTERNAL', 'Database unavailable'))
    }
  })

  app.register(
    async v1 => {
      // onRequest runs before body parsing, so an unauthenticated caller learns nothing about validation.
      v1.addHook('onRequest', async req => {
        req.accountId = await resolveAccount(req, nodeEnv, sql)
      })
      v1.post<{Body: PushRequest}>(
        '/push',
        {schema: {body: PushRequest}},
        async req => {
          const bad = req.body.ops.findIndex(
            o => !o.opType.startsWith(`${o.entityType}.`),
          )
          if (bad >= 0)
            throw new ApiError(
              'VALIDATION',
              `ops[${bad}].opType does not belong to entityType`,
            )
          return {acks: await push(sql, req.accountId, req.body.ops)}
        },
      )
      v1.post<{Body: PullRequest}>(
        '/pull',
        {schema: {body: PullRequest}},
        async req =>
          pull(
            sql,
            req.accountId,
            req.body.cursor,
            req.body.limit ?? DEFAULT_PULL_LIMIT,
          ),
      )
      v1.post('/snapshot', {schema: {body: SnapshotRequest}}, async req =>
        snapshot(sql, req.accountId),
      )
    },
    {prefix: '/v1/sync'},
  )
  return app
}

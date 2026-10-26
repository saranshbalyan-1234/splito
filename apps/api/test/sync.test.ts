import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {mkdtemp, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Writable} from 'node:stream'

import type {
  OpAck,
  PullResponse,
  ServerEntity,
  SnapshotResponse,
  SyncOp,
} from '@splito/contracts'
import {decode, encode} from '@splito/sync'
import {SQL} from 'bun'
import type {FastifyInstance} from 'fastify'

import {buildApp} from '../src/app'
import {migrate} from '../src/migrate'
import {freshDb} from './db'

let db: Awaited<ReturnType<typeof freshDb>>
let app: FastifyInstance
beforeAll(async () => {
  db = await freshDb()
  app = buildApp({sql: db.sql, nodeEnv: 'test', logger: false})
})
afterAll(async () => {
  await app.close()
  await db.drop()
})

const uuid = () => crypto.randomUUID()

async function call(url: string, payload: unknown, account: string | null) {
  const res = await app.inject({
    method: 'POST',
    url,
    payload: payload as object,
    headers: account ? {'x-splito-dev-account': account} : {},
  })
  return {status: res.statusCode, body: res.json()}
}
async function push(account: string, ops: SyncOp[]) {
  const r = await call('/v1/sync/push', {ops}, account)
  expect(r.status).toBe(200)
  return r.body.acks as OpAck[]
}
async function pull(account: string, cursor: string | null, limit?: number) {
  const r = await call('/v1/sync/pull', {cursor, limit}, account)
  expect(r.status).toBe(200)
  return r.body as PullResponse
}

function op(over: Partial<SyncOp> & Pick<SyncOp, 'entityId'>): SyncOp {
  return {
    opId: uuid(),
    deviceId: 'd1',
    actor: 'me',
    entityType: 'expense',
    opType: 'expense.create',
    baseVersion: 0,
    payload: {title: 'Dinner'},
    schemaVersion: 1,
    deps: [],
    ...over,
  }
}

describe('push', () => {
  test('a duplicate op returns its stored ack and applies once', async () => {
    const a = uuid()
    const o = op({entityId: uuid()})
    const [first] = await push(a, [o])
    expect(first).toEqual({opId: o.opId, status: 'applied', revision: 1})
    // Retry with the same opId (even a different body) and a duplicate inside one batch.
    expect(await push(a, [{...o, payload: {title: 'Changed'}}, o])).toEqual([
      first!,
      first!,
    ])
    const {changes} = await pull(a, null)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      id: o.entityId,
      revision: 1,
      data: {title: 'Dinner'},
    })
    const [{n}] =
      await db.sql`SELECT count(*)::int AS n FROM change_log WHERE account_id = ${a}`
    expect(n).toBe(1)
  })

  test('concurrent retries of one op apply it once', async () => {
    const a = uuid()
    const o = op({entityId: uuid()})
    const results = await Promise.all(
      Array.from({length: 8}, () => push(a, [o])),
    )
    expect(new Set(results.map(r => JSON.stringify(r))).size).toBe(1)
    const [{n}] =
      await db.sql`SELECT count(*)::int AS n FROM change_log WHERE account_id = ${a}`
    expect(n).toBe(1)
  })

  test('stale baseVersion on a financial entity is a conflict carrying the server entity', async () => {
    const a = uuid()
    const id = uuid()
    await push(a, [op({entityId: id})])
    // Device 2 edits first and wins revision 2.
    expect(
      await push(a, [
        op({
          entityId: id,
          deviceId: 'd2',
          opType: 'expense.update',
          baseVersion: 1,
          payload: {title: 'Lunch'},
        }),
      ]),
    ).toMatchObject([{status: 'applied', revision: 2}])
    // Device 1 edits from revision 1, then keeps editing its own (rejected) version.
    const stale = op({
      entityId: id,
      opType: 'expense.update',
      baseVersion: 1,
      payload: {title: 'Brunch'},
    })
    const follow = op({
      entityId: id,
      opType: 'expense.update',
      baseVersion: 2,
      payload: {title: 'Brunch!'},
    })
    const [c1, c2] = await push(a, [stale, follow])
    expect(c1).toMatchObject({
      opId: stale.opId,
      status: 'conflict',
      error: {code: 'CONFLICT', retryable: false},
    })
    expect(c1!.status === 'conflict' && c1!.server).toMatchObject({
      type: 'expense',
      id,
      revision: 2,
      deleted: false,
      data: {title: 'Lunch'},
    })
    // The follow-up was built on the rejected edit, so it must not land on top of device 2's revision.
    expect(c2).toMatchObject({opId: follow.opId, status: 'conflict'})
    const {changes} = await pull(a, null)
    expect(changes.map(c => [c.revision, c.data])).toEqual([
      [2, {title: 'Lunch'}],
    ])
    // The conflict ack is canonical too.
    expect(await push(a, [stale])).toEqual([c1!])
  })

  for (const type of ['person', 'group', 'repayment'] as const) {
    test(`stale baseVersion on ${type} conflicts`, async () => {
      const a = uuid()
      const id = uuid()
      await push(a, [
        op({entityType: type, opType: `${type}.create`, entityId: id}),
      ])
      expect(
        await push(a, [
          op({entityType: type, opType: `${type}.create`, entityId: id}),
        ]),
      ).toMatchObject([{status: 'conflict', server: {revision: 1}}])
    })
  }

  test('a tombstone beats stale edits; only a restore revives it', async () => {
    const a = uuid()
    const id = uuid()
    await push(a, [op({entityId: id, payload: {title: 'Taxi'}})])
    expect(
      await push(a, [
        op({
          entityId: id,
          opType: 'expense.delete',
          baseVersion: 1,
          payload: {deleted: true},
        }),
      ]),
    ).toMatchObject([{status: 'applied', revision: 2}])
    const [stale, onTop] = await push(a, [
      op({
        entityId: id,
        opType: 'expense.update',
        baseVersion: 1,
        payload: {title: 'Cab'},
      }),
      op({
        entityId: id,
        deviceId: 'd2',
        opType: 'expense.update',
        baseVersion: 2,
        payload: {title: 'Cab'},
      }),
    ])
    // The tombstone keeps the last live data so a restore or the user can see what was deleted.
    expect(stale).toMatchObject({
      status: 'conflict',
      server: {revision: 2, deleted: true, data: {title: 'Taxi'}},
    })
    expect(onTop).toMatchObject({
      status: 'conflict',
      server: {revision: 2, deleted: true},
    })
    expect(
      await push(a, [
        op({
          entityId: id,
          opType: 'expense.restore',
          baseVersion: 2,
          payload: {title: 'Taxi'},
        }),
      ]),
    ).toMatchObject([{status: 'applied', revision: 3}])
    const {changes} = await pull(a, null)
    expect(changes).toMatchObject([
      {id, revision: 3, deleted: false, data: {title: 'Taxi'}},
    ])
  })

  test('preferences are last-write-wins in server order, whatever the baseVersion', async () => {
    const a = uuid()
    const pref = (
      value: string,
      baseVersion: number,
      opType = 'preference.set',
    ) =>
      op({
        entityType: 'preference',
        opType,
        entityId: 'theme',
        baseVersion,
        payload: {value},
      })
    const acks = await push(a, [
      pref('dark', 0),
      pref('light', 0),
      pref('system', 1, 'preference.reset'),
    ])
    expect(acks.map(x => x.status === 'applied' && x.revision)).toEqual([
      1, 2, 3,
    ])
    expect((await pull(a, null)).changes).toMatchObject([
      {
        type: 'preference',
        id: 'theme',
        revision: 3,
        deleted: true,
        data: {value: 'system'},
      },
    ])
    expect(await push(a, [pref('dark', 1)])).toMatchObject([
      {status: 'applied', revision: 4},
    ])
    expect((await pull(a, null)).changes).toMatchObject([
      {revision: 4, deleted: false, data: {value: 'dark'}},
    ])
  })

  test('bigint payloads round-trip through the @splito/sync codec', async () => {
    const a = uuid()
    const data = {
      title: 'Rent',
      total: 999_999_999_999_999n,
      payers: {me: 999_999_999_999_999n},
    }
    const wire = JSON.parse(
      encode({ops: [op({entityId: uuid(), payload: {}})]}),
    )
    wire.ops[0].payload = JSON.parse(encode(data))
    expect((await call('/v1/sync/push', wire, a)).status).toBe(200)
    const {changes} = await pull(a, null)
    expect(decode(JSON.stringify(changes[0]!.data))).toEqual(data)
  })

  test('more than 200 ops is VALIDATION and applies nothing', async () => {
    const a = uuid()
    const ops = Array.from({length: 201}, () => op({entityId: uuid()}))
    const r = await call('/v1/sync/push', {ops}, a)
    expect(r.status).toBe(400)
    expect(r.body.error).toMatchObject({code: 'VALIDATION', retryable: false})
    expect((await pull(a, null)).changes).toEqual([])
    expect(
      (await call('/v1/sync/push', {ops: ops.slice(0, 200)}, a)).status,
    ).toBe(200)
  })

  test('malformed ops are VALIDATION', async () => {
    const a = uuid()
    for (const bad of [
      {ops: [{...op({entityId: 'x'}), baseVersion: '1'}]},
      {ops: [{...op({entityId: 'x'}), entityType: 'post'}]},
      {
        ops: [
          op({entityId: 'x', entityType: 'group', opType: 'expense.update'}),
        ],
      },
      {nope: true},
    ]) {
      const r = await call('/v1/sync/push', bad, a)
      expect(r.status).toBe(400)
      expect(r.body.error.code).toBe('VALIDATION')
    }
    const r = await app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: {'x-splito-dev-account': a, 'content-type': 'application/json'},
      payload: '{',
    })
    expect(r.json().error.code).toBe('VALIDATION')
  })
})

describe('pull and snapshot', () => {
  test('changes come in commit order, paged, with a cursor that advances', async () => {
    const a = uuid()
    const ids = Array.from({length: 5}, () => uuid())
    await push(
      a,
      ids.slice(0, 3).map(entityId => op({entityId})),
    )
    await push(
      a,
      ids.slice(3).map(entityId => op({entityId})),
    )

    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    for (;;) {
      const page: PullResponse = await pull(a, cursor, 2)
      expect(page.changes.length).toBeLessThanOrEqual(2)
      seen.push(...page.changes.map(c => c.id))
      cursor = page.nextCursor
      pages++
      if (!page.hasMore) break
    }
    expect(seen).toEqual(ids)
    expect(pages).toBe(3)

    // Nothing new: same cursor back, nothing to read.
    expect(await pull(a, cursor)).toEqual({
      changes: [],
      nextCursor: cursor!,
      hasMore: false,
    })

    // An edit after the cursor is the only thing the next pull returns.
    await push(a, [
      op({
        entityId: ids[1]!,
        opType: 'expense.update',
        baseVersion: 1,
        payload: {title: 'Edited'},
      }),
    ])
    const next = await pull(a, cursor)
    expect(next.changes).toMatchObject([
      {id: ids[1], revision: 2, data: {title: 'Edited'}},
    ])
    expect(next.nextCursor).not.toBe(cursor)

    // From the start, the edited entity appears once, at its latest position and revision.
    const expected: Array<[string, number]> = [
      ...[0, 2, 3, 4].map((i): [string, number] => [ids[i]!, 1]),
      [ids[1]!, 2],
    ]
    expect((await pull(a, null)).changes.map(c => [c.id, c.revision])).toEqual(
      expected,
    )
  })

  test('snapshot returns live entities and a cursor to pull from', async () => {
    const a = uuid()
    const [keep, gone] = [uuid(), uuid()]
    await push(a, [
      op({entityId: keep}),
      op({entityId: gone}),
      op({
        entityId: gone,
        opType: 'expense.delete',
        baseVersion: 1,
        payload: {deleted: true},
      }),
    ])
    const r = await call('/v1/sync/snapshot', {}, a)
    expect(r.status).toBe(200)
    const snap = r.body as SnapshotResponse
    expect(snap.entities.map((e: ServerEntity) => e.id)).toEqual([keep])
    expect(await pull(a, snap.cursor)).toMatchObject({
      changes: [],
      hasMore: false,
    })
    await push(a, [
      op({
        entityId: keep,
        opType: 'expense.update',
        baseVersion: 1,
        payload: {title: 'After'},
      }),
    ])
    expect((await pull(a, snap.cursor)).changes).toMatchObject([
      {id: keep, revision: 2},
    ])
  })

  test('invalid cursors are CURSOR_EXPIRED', async () => {
    const a = uuid()
    const real = (await pull(a, null)).nextCursor
    const forged = (seq: string) =>
      Buffer.from(`1:${a}:${seq}`).toString('base64url')
    for (const cursor of [
      'garbage',
      '',
      Buffer.from('2:x:1').toString('base64url'),
      forged('-1'),
      forged('1e3'),
      forged('999999999999'),
    ]) {
      const r = await call('/v1/sync/pull', {cursor}, a)
      expect(r.status).toBe(410)
      expect(r.body.error).toMatchObject({
        code: 'CURSOR_EXPIRED',
        retryable: false,
      })
    }
    expect((await call('/v1/sync/pull', {cursor: real}, a)).status).toBe(200)
  })

  test('tenant isolation: B never sees changes, acks or cursors of A', async () => {
    const [a, b] = [uuid(), uuid()]
    const o = op({entityId: uuid(), payload: {title: 'A secret'}})
    await push(a, [o])
    const aCursor = (await pull(a, null)).nextCursor

    expect(await pull(b, null)).toMatchObject({changes: [], hasMore: false})
    expect((await call('/v1/sync/snapshot', {}, b)).body.entities).toEqual([])
    // Same opId and entity id in B is B's own op, not a replay of A's ack.
    const [bAck] = await push(b, [{...o, payload: {title: 'B'}}])
    expect(bAck).toEqual({opId: o.opId, status: 'applied', revision: 1})
    expect((await pull(b, null)).changes).toMatchObject([{data: {title: 'B'}}])
    expect((await pull(a, null)).changes).toMatchObject([
      {data: {title: 'A secret'}},
    ])
    // A's cursor is not valid for B.
    expect(
      (await call('/v1/sync/pull', {cursor: aCursor}, b)).body.error.code,
    ).toBe('CURSOR_EXPIRED')
  })
})

describe('auth', () => {
  test('missing or malformed dev header is UNAUTHENTICATED', async () => {
    for (const account of [null, 'not-a-uuid']) {
      const r = await call('/v1/sync/pull', {cursor: null}, account)
      expect(r.status).toBe(401)
      expect(r.body.error).toMatchObject({
        code: 'UNAUTHENTICATED',
        retryable: false,
      })
    }
    // Auth runs before body validation.
    expect((await call('/v1/sync/push', {ops: 'x'}, null)).status).toBe(401)
  })

  for (const nodeEnv of ['production', 'staging', undefined]) {
    test(`dev header is rejected when NODE_ENV=${nodeEnv}`, async () => {
      const prod = buildApp({sql: db.sql, nodeEnv, logger: false})
      for (const url of [
        '/v1/sync/push',
        '/v1/sync/pull',
        '/v1/sync/snapshot',
      ]) {
        const r = await prod.inject({
          method: 'POST',
          url,
          payload: {ops: [], cursor: null},
          headers: {'x-splito-dev-account': uuid()},
        })
        expect(r.statusCode).toBe(401)
        expect(r.json().error.code).toBe('UNAUTHENTICATED')
      }
      await prod.close()
    })
  }
})

describe('ops', () => {
  test('/healthz and /readyz', async () => {
    expect((await app.inject('/healthz')).statusCode).toBe(200)
    const ready = await app.inject('/readyz')
    expect(ready.statusCode).toBe(200)
    expect(ready.json<unknown>()).toEqual({ok: true})
  })

  test('/readyz is 503 when the database is unreachable', async () => {
    const dead = new SQL('postgres://nobody@127.0.0.1:1/none', {
      connectionTimeout: 2,
    })
    const broken = buildApp({sql: dead, nodeEnv: 'test', logger: false})
    const r = await broken.inject('/readyz')
    expect(r.statusCode).toBe(503)
    expect(r.json().error).toMatchObject({code: 'INTERNAL', retryable: true})
    expect((await broken.inject('/healthz')).statusCode).toBe(200)
    await broken.close()
    await dead.close()
  })

  test('logs redact payloads and credentials', async () => {
    const lines: string[] = []
    const stream = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk))
        done()
      },
    })
    const logged = buildApp({sql: db.sql, nodeEnv: 'test', logger: {stream}})
    logged.log.info(
      {
        op: {payload: {secret: 'PAYLOAD-1'}},
        body: {ops: ['PAYLOAD-2']},
        headers: {authorization: 'Bearer TOKEN-3'},
      },
      'probe',
    )
    await logged.inject({
      method: 'POST',
      url: '/v1/sync/push',
      payload: {ops: [op({entityId: uuid(), payload: {secret: 'PAYLOAD-4'}})]},
      headers: {
        'x-splito-dev-account': uuid(),
        authorization: 'Bearer TOKEN-5',
      },
    })
    await logged.close()
    const out = lines.join('')
    expect(out).toContain('probe')
    expect(out).toContain('incoming request')
    expect(out).not.toMatch(/PAYLOAD-|TOKEN-/)
  })

  test('migrations are recorded once and a failing file rolls back', async () => {
    expect(await migrate(db.sql)).toEqual([])
    const dir = await mkdtemp(join(tmpdir(), 'splito-mig-'))
    await writeFile(join(dir, '0001_ok.sql'), 'CREATE TABLE mig_ok (a int);')
    await writeFile(
      join(dir, '0002_bad.sql'),
      'CREATE TABLE mig_bad (a int); SELECT no_such_column FROM mig_bad;',
    )
    await expect(migrate(db.sql, dir)).rejects.toThrow()
    const names = (
      await db.sql`SELECT name FROM schema_migrations ORDER BY name`
    ).map((r: {name: string}) => r.name)
    expect(names).toEqual(['0001_init.sql', '0001_ok.sql'])
    const [{bad}] = await db.sql`SELECT to_regclass('mig_bad') IS NULL AS bad`
    expect(bad).toBe(true)
  })
})

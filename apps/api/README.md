# @splito/api

Splito sync service (milestone M2, started): Fastify on Bun 1.4.2, PostgreSQL 17 via
Bun's built-in `Bun.SQL` driver. Wire schemas live in `@splito/contracts`.

> **Real authentication is not implemented.** `resolveAccount()` in `src/app.ts` is the
> only place a request becomes an account. With `NODE_ENV=development` or `test` it
> accepts an `x-splito-dev-account: <uuid>` header (and creates the account row).
> With any other `NODE_ENV`, including unset, every `/v1/sync/*` request is
> `401 UNAUTHENTICATED`. Do not deploy this to real users.

## Setup

```bash
pnpm install                  # repo root
cd apps/api
cp .env.example .env          # Bun loads .env automatically
docker compose up -d db       # postgres:17 on localhost:55432 (or point DATABASE_URL at any Postgres 17)
```

## Run

```bash
bun run dev                   # watch mode; applies migrations, then listens on $PORT (3000)
bun run start                 # same, no watch
bun run migrate               # migrations only
docker compose up --build     # db + api in containers (NODE_ENV=development, local only)
```

`SIGTERM`/`SIGINT` stop accepting connections, let in-flight requests finish, close the pool
and exit 0 (hard exit after 10 s).

```bash
curl localhost:3000/readyz
curl -X POST localhost:3000/v1/sync/pull -H 'content-type: application/json' \
  -H "x-splito-dev-account: $(uuidgen | tr A-Z a-z)" -d '{"cursor":null}'
```

## Test

Tests run against a real Postgres. Each test file creates its own database through
`TEST_DATABASE_URL` (an admin connection) and drops it afterwards.

```bash
docker run --rm -d --name splito-pg -p 55432:5432 -e POSTGRES_PASSWORD=splito postgres:17
bun test                      # default TEST_DATABASE_URL=postgres://postgres:splito@localhost:55432/postgres
docker stop splito-pg
# or, with a local server:
TEST_DATABASE_URL=postgres://$USER@localhost:5432/postgres bun test
pnpm typecheck
```

## Endpoints

| Route                    | Purpose                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `GET /healthz`           | Process is up (no DB).                                                                              |
| `GET /readyz`            | `SELECT 1`; `503` with an `INTERNAL` envelope when the DB is unreachable.                           |
| `POST /v1/sync/push`     | `{ops: SyncOp[]}`, at most 200, returns `{acks}` in order.                                          |
| `POST /v1/sync/pull`     | `{cursor: string \| null, limit?: 1..500}` (default 200), returns `{changes, nextCursor, hasMore}`. |
| `POST /v1/sync/snapshot` | Body `{}`, returns `{entities, cursor}`.                                                            |

Errors are always `{error: {code, message, retryable, details?}}` with codes `VALIDATION` 400,
`UNAUTHENTICATED` 401, `FORBIDDEN` 403, `CONFLICT` 409, `CURSOR_EXPIRED` 410, `RATE_LIMITED` 429,
`INTERNAL` 500. `FORBIDDEN` and `RATE_LIMITED` are defined in the contract but nothing emits
them yet (no auth, no rate limiter). Fastify's own 4xx (malformed JSON, body over 1 MiB) keep
their status and use the `VALIDATION` code.

## Sync semantics

- **Per-op transactions.** Ops apply in request order, each in its own transaction (entity
  row, `change_log` row and `op_receipts` row commit together). A batch can therefore
  partially apply: if op 3 fails unexpectedly the request returns `INTERNAL` (retryable),
  ops 1-2 stay committed, and retrying the same batch replays their stored acks.
- **Idempotency.** `(account_id, op_id)` keys `op_receipts`. A repeated op returns its stored
  ack (applied or conflict) and is never applied twice, even when retries race: writes for
  one account are serialised with a transaction-scoped advisory lock.
- **Revisions.** The server assigns `revision` per entity: 1 on create, +1 per applied op.
  `baseVersion` is the revision the client edited from (0 for a create).
- **Financial entities** (`expense`, `repayment`, `group`, `person`): `baseVersion` must equal
  the server revision, otherwise the ack is `status: "conflict"` with the server entity (or
  `null`). Later ops for the same entity in the same batch also conflict, because they were
  built on the rejected edit. The client must hold its other pending ops for that entity
  until the user resolves the conflict with a new op.
- **Tombstones beat edits.** `<type>.delete` marks the entity deleted and keeps its last
  data. On a tombstone, only `<type>.restore` with the current `baseVersion` applies; any
  other op conflicts and returns the tombstone.
- **Preferences** are last-write-wins in server commit order: `baseVersion` is ignored and
  every op applies. `preference.reset` stores the payload and marks the entity deleted.
- **Payloads are opaque.** They are stored as `jsonb` exactly as sent by the
  `@splito/sync` codec (bigints as `{"$bigint": "..."}`); the server never does money math.
  `deps` is accepted and stored nowhere yet; the client sends ops in outbox order.
- **Pull.** The cursor is an opaque, account-bound position in `change_log.seq`. A page
  holds changes in commit order, each entity once at its latest revision (tombstones
  included). Malformed cursors, another account's cursor, and cursors past anything this
  database issued (a reset or restored DB) are `CURSOR_EXPIRED`: rehydrate from snapshot.
  Nothing prunes `change_log` yet, so no cursor expires by age.
- **Snapshot.** Live entities plus a cursor, read in one `REPEATABLE READ` snapshot. Pull
  from that cursor afterwards. Unpaged for now.

## Layout

```
migrations/*.sql   transactional, applied in name order, recorded in schema_migrations
src/app.ts         routes, error envelope, resolveAccount(), log redaction
src/sync.ts        push / pull / snapshot
src/migrate.ts     migration runner
src/server.ts      entrypoint, graceful shutdown
test/              bun tests against real Postgres
```

Logs are pino JSON. Bodies are never logged, and `body`, `payload`, `data`, `ack`,
`authorization` and `cookie` fields are censored if anything tries.

## Not done yet

Real auth (OTP, Google, Apple, sessions, device registration; the tables exist), rate
limiting, `FORBIDDEN` checks for shared groups, change_log pruning, paged snapshots,
server-side domain validation of payloads, and the client sync engine that calls this API.
The Dockerfile and docker-compose.yml were not built here (no Docker daemon was running);
their install and run steps were replayed on the host instead.

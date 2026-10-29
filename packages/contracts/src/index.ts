/*
 * Sync wire contract, version 1 (routes live under /v1). Schemas are TypeBox,
 * which emits plain JSON Schema: Fastify validates them with its built-in Ajv,
 * and clients check them with `Value.Check` from `typebox/value`, which falls
 * back to an interpreter where `new Function` is unavailable (Hermes, CSP).
 * A breaking change gets a new route version, never an edit here.
 */
import Type, {type Static} from 'typebox'

/** Upper bound on ops in one push. Larger batches are rejected with VALIDATION. */
export const MAX_PUSH_OPS = 200
/** Upper bound on changes per pull page. */
export const MAX_PULL_LIMIT = 500
export const DEFAULT_PULL_LIMIT = 200

/** HTTP status and retry advice per error code. */
export const ERRORS = {
  VALIDATION: {status: 400, retryable: false},
  UNAUTHENTICATED: {status: 401, retryable: false},
  FORBIDDEN: {status: 403, retryable: false},
  CONFLICT: {status: 409, retryable: false},
  /** The cursor is unknown to this server (malformed, other account, or pruned): rehydrate from /snapshot. */
  CURSOR_EXPIRED: {status: 410, retryable: false},
  RATE_LIMITED: {status: 429, retryable: true},
  INTERNAL: {status: 500, retryable: true},
} as const satisfies Record<string, {status: number; retryable: boolean}>

export type ErrorCode = keyof typeof ERRORS
export const ErrorCode = Type.Enum(Object.keys(ERRORS) as ErrorCode[])

export const ErrorBody = Type.Object({
  code: ErrorCode,
  message: Type.String(),
  retryable: Type.Boolean(),
  details: Type.Optional(Type.Unknown()),
})
export type ErrorBody = Static<typeof ErrorBody>

/** Every non-2xx response body. */
export const ErrorEnvelope = Type.Object({error: ErrorBody})
export type ErrorEnvelope = Static<typeof ErrorEnvelope>

/* 'repayment' is ahead of @splito/sync's EntityType: the server accepts it so repayments need no protocol bump. */
export const ENTITY_TYPES = [
  'person',
  'group',
  'expense',
  'repayment',
  'preference',
] as const
export const EntityType = Type.Enum([...ENTITY_TYPES])
export type EntityType = Static<typeof EntityType>

const Id = Type.String({minLength: 1, maxLength: 128})

/**
 * One outbox op on the wire: @splito/sync `OutboxOp` minus its device-local
 * retry fields (seq, attempts, nextAttemptAt, lastError), which servers ignore.
 * `payload` is the entity data encoded with the @splito/sync codec (bigints as
 * {"$bigint": "..."}) and stays opaque to the server.
 */
export const SyncOp = Type.Object({
  opId: Id,
  deviceId: Id,
  actor: Id,
  entityType: EntityType,
  entityId: Id,
  /** `<entityType>.<verb>`, e.g. expense.update. `.delete` tombstones, `.restore` revives, `preference.reset` clears. */
  opType: Type.String({pattern: '^[a-z]+\\.[a-z]+$', maxLength: 64}),
  /** The server revision this edit was based on; 0 for a create. */
  baseVersion: Type.Integer({minimum: 0}),
  payload: Type.Record(Type.String(), Type.Unknown()),
  schemaVersion: Type.Literal(1),
  deps: Type.Array(Id, {maxItems: 64}),
})
export type SyncOp = Static<typeof SyncOp>

/** An entity as the server holds it. `revision` is server-assigned and monotonic per entity. */
export const ServerEntity = Type.Object({
  type: EntityType,
  id: Id,
  revision: Type.Integer({minimum: 1}),
  deleted: Type.Boolean(),
  data: Type.Unknown(),
  /** Server commit time, epoch ms. */
  updatedAt: Type.Integer(),
})
export type ServerEntity = Static<typeof ServerEntity>

/**
 * Outcome of one op. Acks are stored per (account, opId): re-pushing an op
 * returns its original ack. A conflict carries the server's current entity (or
 * null when it does not exist) for the user to resolve with a new op.
 */
export const OpAck = Type.Union([
  Type.Object({
    opId: Id,
    status: Type.Literal('applied'),
    revision: Type.Integer({minimum: 1}),
  }),
  Type.Object({
    opId: Id,
    status: Type.Literal('conflict'),
    error: ErrorBody,
    server: Type.Union([ServerEntity, Type.Null()]),
  }),
])
export type OpAck = Static<typeof OpAck>

/** POST /v1/sync/push */
export const PushRequest = Type.Object({
  ops: Type.Array(SyncOp, {maxItems: MAX_PUSH_OPS}),
})
export type PushRequest = Static<typeof PushRequest>
/** One ack per op, in request order. */
export const PushResponse = Type.Object({acks: Type.Array(OpAck)})
export type PushResponse = Static<typeof PushResponse>

/** POST /v1/sync/pull. `cursor: null` reads from the beginning. */
export const PullRequest = Type.Object({
  cursor: Type.Union([Type.String({maxLength: 512}), Type.Null()]),
  limit: Type.Optional(Type.Integer({minimum: 1, maximum: MAX_PULL_LIMIT})),
})
export type PullRequest = Static<typeof PullRequest>
/** Changes in commit order, each entity at its latest revision (tombstones included). */
export const PullResponse = Type.Object({
  changes: Type.Array(ServerEntity),
  nextCursor: Type.String(),
  hasMore: Type.Boolean(),
})
export type PullResponse = Static<typeof PullResponse>

/** POST /v1/sync/snapshot with body `{}`. */
export const SnapshotRequest = Type.Object({})
export type SnapshotRequest = Static<typeof SnapshotRequest>
/** Live (non-deleted) entities plus the cursor to pull from afterwards. */
export const SnapshotResponse = Type.Object({
  entities: Type.Array(ServerEntity),
  cursor: Type.String(),
})
export type SnapshotResponse = Static<typeof SnapshotResponse>

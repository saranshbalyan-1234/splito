import {assertInRange, DomainError, getCurrency, parseLocalDate, validateExpense} from '@splito/domain'

import {decode, encode} from './codec'
import {inviteLinkState, type InviteLink} from './friends'
import {write} from './mutations'
import {PREFS, type PrefKey} from './preferences'
import {ENTITY_TYPES, type Key, SCHEMA_VERSION} from './schema'
import {type Page, type Store} from './store'
import {type Entity, type EntityType, type HistoryRow, type MutationCtx} from './types'

/*
 * JSON backup and restore (F-2001). One versioned file holds every entity
 * store (iterating ENTITY_TYPES, so a new entity type is backed up and
 * restored without touching this file) and the history behind it. The outbox
 * is not in the file: a restore queues its own ops. Money is exact (bigint as
 * decimal strings, the codec's form). Import is validated whole before any
 * write and applied in one transaction, so a bad file changes nothing.
 */

export const BACKUP_FORMAT = 'splito-backup'
/** The file layout. Bump it with a step in MIGRATIONS when the layout changes. */
export const BACKUP_VERSION = 1

/** One stored row, without the device's own sync bookkeeping. */
export interface BackupEntity {
  id: string
  data: unknown
  version: number
  deleted: boolean
  createdAt: number
  updatedAt: number
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  /** The database schema the rows came from. */
  schemaVersion: number
  exportedAt: number
  /** The exporting device's "me" person id; remapped to this device's on import. */
  meId: string
  entities: Partial<Record<EntityType, BackupEntity[]>>
  history: HistoryRow[]
  checksum?: string
}

export type RestoreMode = 'merge' | 'replace'

export interface TypeCounts {
  /** In the file, not on this device. */
  add: number
  /** On both, and the file's version replaces this device's. */
  overwrite: number
  /** On both and equal. */
  same: number
  /** On both and different, but this device's is newer (merge only). */
  keep: number
  /** Only on this device, to be tombstoned (replace only). */
  remove: number
}

export interface BackupPreview extends TypeCounts {
  exportedAt: number
  /** The file was made by another "me": its rows are re-pointed at this device's. */
  foreignIdentity: boolean
  counts: Record<EntityType, TypeCounts>
}

export interface BackupResult {
  added: number
  overwritten: number
  removed: number
  /** Left alone: this device's row is newer (merge). */
  kept: number
  same: number
}

/** The error code is the message: BACKUP_INVALID, BACKUP_CORRUPT, BACKUP_TOO_NEW, BACKUP_BROKEN_REFERENCE. */
function fail(code: string): never {
  throw new DomainError(code)
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

/** Every entity (tombstones included) and every history row on this device. Reads everything by design: export is not a hot path. */
export async function createBackup(store: Store, ctx: MutationCtx): Promise<BackupFile> {
  const d = await store.dump()
  const entities: BackupFile['entities'] = {}
  for (const type of ENTITY_TYPES) entities[type] = []
  const now = ctx.now()
  for (const e of d.entities) {
    if (!isExportable(e.type, e, now)) continue
    entities[e.type]!.push({id: e.id, data: e.data, version: e.version, deleted: e.deleted, createdAt: e.createdAt, updatedAt: e.updatedAt})
  }
  for (const list of Object.values(entities)) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {format: BACKUP_FORMAT, version: BACKUP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: ctx.now(), meId: ctx.actor, entities, history: d.history}
}

/**
 * What never leaves in a file: preferences that belong to the device (and any
 * this build does not define), and invite links that still work (a live link
 * is a secret that grants access; a revoked or expired one is only history).
 */
function isExportable(type: EntityType, e: {id: string; data: unknown; deleted: boolean}, now: number): boolean {
  if (type === 'preference') return PREFS[e.id as PrefKey]?.scope === 'account'
  if (type === 'inviteLink') return e.deleted || inviteLinkState(e.data as InviteLink, now) !== 'active'
  return true
}

/**
 * A fast 53-bit string hash (cyrb53). It catches a damaged or hand-edited
 * file, it is not a signature. ponytail: not cryptographic; add AES-GCM with F-2002.
 */
function checksum(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/** The checksum covers the header too, so a changed `meId`, version or date is caught. */
const sumOf = (f: {format?: unknown; version?: unknown; schemaVersion?: unknown; exportedAt?: unknown; meId?: unknown; entities: unknown; history: unknown}) =>
  checksum(encode({format: f.format, version: f.version, schemaVersion: f.schemaVersion, exportedAt: f.exportedAt, meId: f.meId, entities: f.entities, history: f.history}))

/** The file's text: JSON with exact amounts and a checksum. */
export function serializeBackup(file: BackupFile): string {
  return encode({...file, checksum: sumOf(file)})
}

/* -------------------------------------------------------------------------- */
/* Read: migrate and validate                                                 */
/* -------------------------------------------------------------------------- */

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Older file layouts, one step each: `MIGRATIONS[n]` turns a version n file into n + 1. None yet; version 1 is the first. */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {}

/** Walks a file up to `target` one step at a time; a gap in the chain is an invalid file. */
export function upgradeBackup(raw: Raw, migrations: Record<number, (raw: Raw) => Raw> = MIGRATIONS, target = BACKUP_VERSION): Raw {
  let cur = raw
  while ((cur.version as number) < target) {
    const step = migrations[cur.version as number]
    if (!step) fail('BACKUP_INVALID')
    cur = step!(cur)
  }
  return cur
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isMoney = (v: unknown): v is bigint => typeof v === 'bigint'
const moneyRecord = (v: unknown) => isObj(v) && Object.values(v).every(isMoney)

/** Shape checks for the types that carry money or structure; every other type just needs object data. */
const SHAPES: Partial<Record<EntityType, (d: Raw) => void>> = {
  person: d => {
    if (!isStr(d.name) || typeof d.isMe !== 'boolean') fail('BACKUP_CORRUPT')
  },
  group: d => {
    if (!isStr(d.name) || !Array.isArray(d.members) || !d.members.every(m => isObj(m) && isStr(m.personId))) fail('BACKUP_CORRUPT')
    getCurrency(d.currency as string)
  },
  expense: d => {
    if (!isStr(d.title) || !isMoney(d.total) || !moneyRecord(d.payers) || !moneyRecord(d.shares)) fail('BACKUP_CORRUPT')
    if (d.groupId !== null && !isStr(d.groupId)) fail('BACKUP_CORRUPT')
    getCurrency(d.currency as string)
    parseLocalDate(d.date as string)
    validateExpense({total: d.total as bigint, payers: d.payers as Record<string, bigint>, shares: d.shares as Record<string, bigint>})
  },
  repayment: transfer,
  writeoff: transfer,
  preference: d => {
    if (!('value' in d)) fail('BACKUP_CORRUPT')
  },
}

function transfer(d: Raw) {
  if (!isStr(d.from) || !isStr(d.to) || !isMoney(d.amount) || d.amount <= 0n) fail('BACKUP_CORRUPT')
  assertInRange(d.amount as bigint)
  getCurrency(d.currency as string)
  parseLocalDate(d.date as string)
}

function checkEntity(type: EntityType, e: unknown) {
  if (!isObj(e) || !isStr(e.id) || !e.id || !Number.isInteger(e.version) || (e.version as number) < 1 || typeof e.deleted !== 'boolean' || !isNum(e.createdAt) || !isNum(e.updatedAt) || !isObj(e.data))
    fail('BACKUP_CORRUPT')
  SHAPES[type]?.(e.data as Raw)
}

function checkHistory(h: unknown, seen: Set<string>) {
  if (!isObj(h) || !(ENTITY_TYPES as string[]).includes(h.entityType as string) || !isStr(h.entityId) || !Number.isInteger(h.version) || typeof h.deleted !== 'boolean' || !isNum(h.at) || !isStr(h.actor))
    fail('BACKUP_CORRUPT')
  const key = `${h.entityType}:${h.entityId}:${h.version}`
  if (seen.has(key)) fail('BACKUP_CORRUPT')
  seen.add(key)
}

/**
 * Text -> a file that is safe to apply, or a thrown `DomainError`; nothing
 * is touched. Rejects: not JSON or not ours (BACKUP_INVALID), made by a newer
 * build (BACKUP_TOO_NEW), a failed checksum or rows whose shape or money does
 * not hold together (BACKUP_CORRUPT).
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = decode(text)
  } catch {
    return fail('BACKUP_INVALID')
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT || !Number.isInteger(raw.version) || (raw.version as number) < 0) return fail('BACKUP_INVALID')
  if (!Number.isInteger(raw.schemaVersion)) return fail('BACKUP_INVALID')
  if ((raw.version as number) > BACKUP_VERSION || (raw.schemaVersion as number) > SCHEMA_VERSION) return fail('BACKUP_TOO_NEW')
  // ponytail: no row migrations exist yet, so rows from an older schema are not guessed at; add them with the first schema step.
  if ((raw.schemaVersion as number) < SCHEMA_VERSION) return fail('BACKUP_TOO_OLD')
  if (!isObj(raw.entities) || !Array.isArray(raw.history) || !isStr(raw.meId)) return fail('BACKUP_INVALID')
  // A type this build does not know would be dropped silently: refuse the file instead.
  if (Object.keys(raw.entities).some(t => !(ENTITY_TYPES as string[]).includes(t))) return fail('BACKUP_TOO_NEW')
  if (raw.version === BACKUP_VERSION && raw.checksum !== sumOf(raw as Parameters<typeof sumOf>[0])) return fail('BACKUP_CORRUPT')
  const file = upgradeBackup(raw) as unknown as BackupFile
  const ids = new Set<string>()
  for (const type of ENTITY_TYPES) {
    const list = file.entities[type] ?? []
    if (!Array.isArray(list)) return fail('BACKUP_CORRUPT')
    for (const e of list as BackupEntity[]) {
      checkEntity(type, e)
      if (ids.has(`${type}:${e.id}`)) return fail('BACKUP_CORRUPT')
      ids.add(`${type}:${e.id}`)
    }
  }
  const seen = new Set<string>()
  for (const h of file.history as unknown[]) checkHistory(h, seen)
  return file
}

/* -------------------------------------------------------------------------- */
/* Plan: what a restore would do                                              */
/* -------------------------------------------------------------------------- */

/** Points every reference to the file's "me" (ids, map keys, actors) at this device's. */
function remapIdentity<T>(v: T, from: string, to: string): T {
  if (typeof v === 'string') return (v === from ? to : v) as T
  if (Array.isArray(v)) return v.map(x => remapIdentity(x, from, to)) as T
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) {
      const key = k === from ? to : k
      // Two keys folding into one would drop an amount: refuse rather than save a broken expense.
      if (key in out) fail('BACKUP_CORRUPT')
      out[key] = remapIdentity(x, from, to)
    }
    return out as T
  }
  return v
}

type Action =
  | {kind: 'add' | 'overwrite'; type: EntityType; entity: BackupEntity}
  | {kind: 'remove'; type: EntityType; id: string}

const emptyCounts = (): TypeCounts => ({add: 0, overwrite: 0, same: 0, keep: 0, remove: 0})
const PAGE = 200

/** Rows the app itself would not queue for a server: feedback, and device-scoped preferences. */
function isQueued(type: EntityType, id: string): boolean {
  if (type === 'feedback') return false
  if (type === 'preference') return PREFS[id as PrefKey]?.scope === 'account'
  return true
}

/** A preference this build does not define, or whose value it would not accept, is left out (not corruption: a newer build may have added it). */
function isApplicable(type: EntityType, e: BackupEntity, now: number): boolean {
  if (!isExportable(type, e, now)) return false
  if (type !== 'preference') return true
  return e.deleted || PREFS[e.id as PrefKey]!.validate((e.data as {value: unknown}).value)
}

async function* deviceRows(store: Store, type: EntityType) {
  let after: Key | null = null
  do {
    // full-read-ok: a restore in replace mode must see every row to know what the file lacks; it pages the store, once, on an explicit user action
    const page: Page<Entity> = await store.page(type, {after, limit: PAGE})
    yield* page.items
    after = page.next
  } while (after)
}

/**
 * The file as this device would read it: "me" remapped, the foreign me person
 * left out. A person row that carries this device's me id (or the file's me id
 * without being that me) would overwrite or fold into me, so it is refused; the
 * remapped rows are checked again, since remapping changes ids and map keys.
 */
function localFile(file: BackupFile, meId: string) {
  const foreign = file.meId !== meId
  const isFileMe = (e: BackupEntity) => e.id === file.meId && !!(e.data as {isMe?: boolean}).isMe
  for (const e of file.entities.person ?? [])
    if ((e.id === meId && (foreign || !(e.data as {isMe?: boolean}).isMe)) || (e.id === file.meId && !isFileMe(e))) fail('BACKUP_CORRUPT')
  const entities: Record<string, BackupEntity[]> = {}
  for (const type of ENTITY_TYPES) {
    entities[type] = (file.entities[type] ?? [])
      .filter(e => !(type === 'person' && isFileMe(e)))
      .map(e => (foreign ? remapIdentity(e, file.meId, meId) : e))
    if (foreign) for (const e of entities[type]!) checkEntity(type, e)
  }
  const history = foreign ? remapIdentity(file.history, file.meId, meId) : file.history
  return {entities, history, foreign}
}

async function plan(store: Store, ctx: MutationCtx, file: BackupFile, mode: RestoreMode) {
  const local = localFile(file, ctx.actor)
  const counts = Object.fromEntries(ENTITY_TYPES.map(t => [t, emptyCounts()])) as Record<EntityType, TypeCounts>
  const actions: Action[] = []
  for (const type of ENTITY_TYPES) {
    const list = local.entities[type]!.filter(e => isApplicable(type, e, ctx.now()))
    for (let i = 0; i < list.length; i += PAGE) {
      const chunk = list.slice(i, i + PAGE)
      const prevs = new Map((await store.getMany(type, chunk.map(e => e.id))).map(p => [p.id, p]))
      for (const entity of chunk) {
        const prev = prevs.get(entity.id)
        if (!prev) {
          counts[type].add++
          actions.push({kind: 'add', type, entity})
        } else if (prev.deleted === entity.deleted && encode(prev.data) === encode(entity.data)) counts[type].same++
        else if (mode === 'replace' || entity.updatedAt > prev.updatedAt) {
          counts[type].overwrite++
          actions.push({kind: 'overwrite', type, entity})
        } else counts[type].keep++
      }
    }
  }
  if (mode === 'replace') {
    for (const type of ENTITY_TYPES) {
      if (type === 'feedback') continue
      const inFile = new Set(local.entities[type]!.map(e => e.id))
      for await (const e of deviceRows(store, type)) {
        if (e.deleted || inFile.has(e.id) || (type === 'person' && (e.data as {isMe?: boolean}).isMe)) continue
        counts[type].remove++
        actions.push({kind: 'remove', type, id: e.id})
      }
    }
  }
  await checkReferences(store, local.entities, actions, mode, ctx.actor)
  return {actions, counts, local}
}

/** True for a group that takes no new expenses: inactive, or archived by an older build. */
const isInactive = (d: Raw) => !!(d.inactive || d.archived)

/**
 * Every live person and group a restored live row names must exist and be live
 * (in the file, or on this device when merging): a tombstone is not someone
 * to attach money to. A restore also adds no expense to an inactive group
 * (GROUP_INACTIVE); payments and write-offs may still land. A group that
 * arrives in this same restore, with its own expenses, is the history being
 * brought back, not a change to an inactive group.
 */
async function checkReferences(store: Store, entities: Record<string, BackupEntity[]>, actions: Action[], mode: RestoreMode, meId: string) {
  const live = (type: EntityType) => new Set(entities[type]!.filter(e => !e.deleted).map(e => e.id))
  const have = {person: new Set([...live('person'), meId]), group: live('group')}
  const missing = {person: new Set<string>(), group: new Set<string>()}
  const need = (type: 'person' | 'group', id: string | null | undefined) => {
    if (id && !have[type].has(id)) missing[type].add(id)
  }
  const added = new Set(actions.flatMap(a => (a.kind === 'add' && a.type === 'group' ? [a.entity.id] : [])))
  const groupsToCheck = new Set<string>()
  for (const a of actions) {
    if (a.kind === 'remove' || a.entity.deleted) continue
    const d = a.entity.data as Raw
    if (a.type === 'expense') {
      for (const p of [...Object.keys(d.payers as object), ...Object.keys(d.shares as object)]) need('person', p)
      need('group', d.groupId as string | null)
      if (d.groupId && !added.has(d.groupId as string)) groupsToCheck.add(d.groupId as string)
    } else if (a.type === 'repayment' || a.type === 'writeoff') {
      need('person', d.from as string)
      need('person', d.to as string)
      need('group', d.groupId as string | null)
    } else if (a.type === 'group') for (const m of d.members as Array<{personId: string}>) need('person', m.personId)
  }
  if (mode === 'merge') {
    for (const type of ['person', 'group'] as const)
      if (missing[type].size) for (const e of await store.getMany(type, [...missing[type]])) if (!e.deleted) missing[type].delete(e.id)
  }
  if (missing.person.size || missing.group.size) fail('BACKUP_BROKEN_REFERENCE')
  // The group as it will be once this restore is done: the file's row when it brings one, else this device's.
  const arriving = new Map(actions.flatMap(a => (a.kind !== 'remove' && a.type === 'group' ? [[a.entity.id, a.entity.data as Raw] as const] : [])))
  const here = new Map((await store.getMany<Raw>('group', [...groupsToCheck].filter(id => !arriving.has(id)))).map(g => [g.id, g.data]))
  for (const id of groupsToCheck) if (isInactive(arriving.get(id) ?? here.get(id) ?? {})) fail('GROUP_INACTIVE')
}

/** What restoring `file` would change, without writing anything. */
export async function previewBackup(store: Store, ctx: MutationCtx, file: BackupFile, mode: RestoreMode): Promise<BackupPreview> {
  const {counts, local} = await plan(store, ctx, file, mode)
  const total = emptyCounts()
  for (const c of Object.values(counts)) for (const k of Object.keys(total) as Array<keyof TypeCounts>) total[k] += c[k]
  return {...total, exportedAt: file.exportedAt, foreignIdentity: local.foreign, counts}
}

/* -------------------------------------------------------------------------- */
/* Apply                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Restores `file`: `merge` adds what is missing and takes the file's version
 * of a row only when it is newer; `replace` makes this device match the file,
 * tombstoning (never erasing) what the file lacks. Every write, its history
 * and its outbox op commit together or not at all; the derived tables are
 * rebuilt afterwards.
 */
export async function applyBackup(store: Store, ctx: MutationCtx, file: BackupFile, mode: RestoreMode): Promise<BackupResult> {
  const {actions, counts, local} = await plan(store, ctx, file, mode)
  const histories = new Map<string, HistoryRow[]>()
  for (const h of local.history) {
    const key = `${h.entityType}:${h.entityId}`
    ;(histories.get(key) ?? histories.set(key, []).get(key)!).push(h)
  }
  const result: BackupResult = {added: 0, overwritten: 0, removed: 0, kept: 0, same: 0}
  for (const c of Object.values(counts)) {
    result.kept += c.keep
    result.same += c.same
  }
  if (actions.length === 0) return result
  await store.transaction(async tx => {
    for (const a of actions) {
      if (a.kind === 'remove') {
        const prev = await tx.get(a.type, a.id)
        if (!prev || prev.deleted) continue
        await write(tx, ctx, a.type, a.id, prev.data, true, isQueued(a.type, a.id) ? 'backup.remove' : null)
        result.removed++
        continue
      }
      const {entity: e} = a
      const queued = isQueued(a.type, e.id)
      if (a.kind === 'overwrite') {
        await write(tx, ctx, a.type, e.id, e.data, e.deleted, queued ? 'backup.import' : null)
        result.overwritten++
        continue
      }
      // A new row keeps the file's version, times and history, so a restored phone shows the original dates.
      if (await tx.get(a.type, e.id)) continue
      await tx.put({type: a.type, id: e.id, data: e.data, version: e.version, deleted: e.deleted, createdAt: e.createdAt, updatedAt: e.updatedAt, syncStatus: 'local'})
      const past = histories.get(`${a.type}:${e.id}`) ?? []
      for (const h of past) await tx.appendHistory(h)
      if (!past.some(h => h.version === e.version))
        await tx.appendHistory({entityType: a.type, entityId: e.id, version: e.version, data: e.data, deleted: e.deleted, at: e.updatedAt, actor: ctx.actor})
      if (queued)
        await tx.enqueue({
          opId: ctx.newId(),
          deviceId: ctx.deviceId,
          actor: ctx.actor,
          entityType: a.type,
          entityId: e.id,
          opType: 'backup.import',
          baseVersion: 0,
          payload: e.deleted ? {deleted: true} : e.data,
          schemaVersion: 1,
          deps: [],
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
        })
      result.added++
    }
  })
  await store.rebuildProjections()
  return result
}

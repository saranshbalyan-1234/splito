/* eslint-disable no-console */
/*
 * Splito's telemetry module (ARCHITECTURE 16.2, A-019). Same call surface as
 * Bluesky's logger (`logger.error(error, metadata)`), plus `recordMetric`,
 * `recordIssue` and `recordFriction` (16.3). Recording only enqueues and never
 * throws; a drain runs when the app is idle, in slices of at most 4 ms, and
 * `flush()` empties the queue (the app calls it on going to background).
 * The console sink is the local developer's (raw, as before); the remote sink
 * gets scrubbed entries carrying opaque ids only, and only while Send
 * diagnostics is on. M1 has no remote vendor: the sink stays null until A-046.
 */
import {type Attributes, isOpaqueId, scrubAttributes, scrubMetadata, scrubText} from './scrub'

type Metadata = Record<string, unknown>
type Level = 'debug' | 'info' | 'warn' | 'error'

/** Who an entry is about: an opaque install id and, once signed in (M2), an opaque account id. Never an email or name. */
export type Identity = {installId?: string; accountId?: string}

/** One scrubbed record, as a remote sink receives it. */
export type Entry = {
  kind: 'log' | 'metric' | 'issue' | 'friction'
  /** Epoch ms when it was recorded (not sent). */
  at: number
  identity: Identity
  level?: Level
  message?: string
  metadata?: Metadata
  name?: string
  attrs?: Attributes
}

export type Sink = (entries: Entry[]) => void

type Pending = {
  kind: Entry['kind']
  at: number
  identity: Identity
  level?: Level
  message?: unknown
  metadata?: Metadata
  name?: string
  attrs?: Record<string, unknown>
}

const MAX_QUEUE = 500
const SLICE_MS = 4

const IS_TEST = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__

let queue: Pending[] = []
let identity: Identity = {}
let isDiagnosticsOn = true
let remoteSink: Sink | null = null
let isScheduled = false

/** Sets the opaque ids entries carry. A value that is not opaque (an email, phone or name) is ignored. */
export function setTelemetryIdentity(next: Identity) {
  const ok = (id: string | undefined) => (id !== undefined && isOpaqueId(id) ? id : undefined)
  identity = {
    ...identity,
    ...(next.installId !== undefined && ok(next.installId) ? {installId: next.installId} : {}),
    ...(next.accountId !== undefined && ok(next.accountId) ? {accountId: next.accountId} : {}),
  }
}

/** The Send diagnostics switch (`sendDiagnostics` preference): off, nothing reaches the remote sink. */
export function setDiagnosticsEnabled(on: boolean) {
  isDiagnosticsOn = on
}

/** The vendor transport, once one exists (M2, A-046). */
export function setRemoteSink(sink: Sink | null) {
  remoteSink = sink
}

/** Entries recorded and not yet drained. */
export function pendingCount() {
  return queue.length
}

const schedule = (fn: () => void) => {
  const idle = (globalThis as {requestIdleCallback?: (cb: () => void) => void}).requestIdleCallback
  if (idle) idle(fn)
  else setTimeout(fn, 0)
}

function enqueue(entry: Omit<Pending, 'at' | 'identity'>) {
  try {
    queue.push({...entry, at: Date.now(), identity: {...identity}})
    // Oldest first out: a flood keeps the newest MAX_QUEUE.
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
    if (!isScheduled) {
      isScheduled = true
      schedule(drainSlice)
    }
  } catch {
    // Recording must never break the caller.
  }
}

function toConsole(p: Pending) {
  if (IS_TEST || (p.kind === 'log' && p.level === 'debug' && !IS_DEV)) return
  if (p.kind !== 'log' && !IS_DEV) return
  const args = p.kind === 'log' ? [p.message, p.metadata ?? ''] : [`[${p.kind}] ${p.name}`, p.attrs ?? '']
  if (p.level === 'error') console.error(...args)
  else if (p.level === 'warn') console.warn(...args)
  else if (p.level === 'debug') console.debug(...args)
  else console.info(...args)
}

function toEntry(p: Pending): Entry {
  const entry: Entry = {kind: p.kind, at: p.at, identity: p.identity}
  if (p.level) entry.level = p.level
  if (p.message !== undefined)
    entry.message = p.message instanceof Error ? `${p.message.name}: ${scrubText(p.message.message)}` : scrubText(String(p.message))
  if (p.metadata) entry.metadata = scrubMetadata(p.metadata)
  if (p.name !== undefined) entry.name = p.name
  if (p.attrs) entry.attrs = scrubAttributes(p.attrs)
  return entry
}

function send(batch: Pending[]) {
  for (const p of batch) {
    try {
      toConsole(p)
    } catch {
      // A console that throws (odd metadata) loses only that line.
    }
  }
  if (!remoteSink || !isDiagnosticsOn) return
  try {
    remoteSink(batch.map(toEntry))
  } catch {
    // A failing vendor never reaches the app.
  }
}

function drainSlice() {
  const start = Date.now()
  const batch: Pending[] = []
  while (queue.length && Date.now() - start < SLICE_MS) {
    batch.push(queue.shift()!)
    // Scrubbing is the slow part; do it inside the slice.
    if (batch.length % 20 === 0) {
      send(batch.splice(0))
    }
  }
  send(batch)
  if (queue.length) schedule(drainSlice)
  else isScheduled = false
}

/** Sends everything recorded so far, now (on going to background, before a restart). Never throws. */
export function flush() {
  const batch = queue
  queue = []
  send(batch)
}

/** A flow completed (16.3): name plus enum, boolean or small-number attributes. */
export function recordMetric(name: string, attrs: Record<string, unknown> = {}) {
  enqueue({kind: 'metric', name, attrs})
}

/** A real failure (16.5): a service and a code, nothing personal. */
export function recordIssue(service: string, {code}: {code: string}) {
  enqueue({kind: 'issue', name: `${service}/${code}`})
}

/** Friction the person met (tap while busy, dead link, inline error): a kind only. */
export function recordFriction(kind: string) {
  enqueue({kind: 'friction', name: kind})
}

const log = (level: Level) => (message: unknown, metadata?: Metadata) => enqueue({kind: 'log', level, message, metadata})

/** Bluesky's call surface: `logger.error(message, metadata)`. */
export const logger = {
  debug: log('debug') as (message: string, metadata?: Metadata) => void,
  info: log('info') as (message: string, metadata?: Metadata) => void,
  warn: log('warn') as (message: string, metadata?: Metadata) => void,
  error: log('error') as (error: unknown, metadata?: Metadata) => void,
}

/** Tests only: an empty queue and default switches. */
export function resetTelemetryForTests() {
  queue = []
  identity = {}
  isDiagnosticsOn = true
  remoteSink = null
}
